import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { inTransaction, pool } from '../database.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { writeAudit } from '../services/audit-service.js';

const router = Router();
router.use(authenticate);

function normaliseRoleIds(roleIds, required = true) {
  if (!Array.isArray(roleIds) || (required && roleIds.length === 0)) {
    const error = new Error('Seleccione pelo menos um perfil.');
    error.status = 422;
    throw error;
  }
  const ids = [...new Set(roleIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) {
    const error = new Error('Seleccione pelo menos um perfil válido.');
    error.status = 422;
    throw error;
  }
  return ids;
}

function normalisePermissionIds(permissionIds) {
  if (!Array.isArray(permissionIds)) {
    const error = new Error('A lista de permissões é inválida.');
    error.status = 422;
    throw error;
  }
  return [...new Set(permissionIds.map(Number).filter(Number.isInteger))];
}

router.get('/users', authorize('user.manage'), async (request, response, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.username, u.active, u.created_at,
              GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id ORDER BY u.name`
    );
    response.json(rows);
  } catch (error) { next(error); }
});

router.post('/users', authorize('user.manage'), async (request, response, next) => {
  try {
    const { name, email, username, password } = request.body;
    const roleIds = normaliseRoleIds(request.body.roleIds);
    if (!name?.trim() || !email?.trim() || !username?.trim() || !password || password.length < 8) {
      return response.status(422).json({ message: 'Nome, e-mail, utilizador e palavra-passe de pelo menos 8 caracteres são obrigatórios.' });
    }
    const user = await inTransaction(async (connection) => {
      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await connection.execute('INSERT INTO users (name, email, username, password_hash, active) VALUES (?, ?, ?, ?, TRUE)', [name.trim(), email.trim().toLowerCase(), username.trim(), passwordHash]);
      for (const roleId of roleIds) await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roleId]);
      await writeAudit(connection, { actorId: request.user.id, action: 'USER_CREATED', entity: 'user', entityId: result.insertId, after: { name: name.trim(), username: username.trim(), roleIds }, ipAddress: request.ip });
      return { id: result.insertId, name: name.trim(), username: username.trim() };
    });
    response.status(201).json(user);
  } catch (error) { next(error); }
});

router.patch('/users/:id', authorize('user.manage'), async (request, response, next) => {
  try {
    const userId = Number(request.params.id);
    const active = request.body.active;
    const roleIds = request.body.roleIds === undefined ? null : normaliseRoleIds(request.body.roleIds, false);
    const permissionIds = request.body.permissionIds === undefined ? null : normalisePermissionIds(request.body.permissionIds);
    if (!Number.isInteger(userId) || (active === undefined && roleIds === null && permissionIds === null)) return response.status(422).json({ message: 'Indique uma alteração válida.' });
    if (userId === request.user.id && active === false) return response.status(409).json({ message: 'Não pode desactivar a sua própria conta.' });
    await inTransaction(async (connection) => {
      const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
      if (!users.length) { const error = new Error('Utilizador não encontrado.'); error.status = 404; throw error; }
      if (active !== undefined) await connection.execute('UPDATE users SET active = ? WHERE id = ?', [Boolean(active), userId]);
      if (roleIds) {
        await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        for (const roleId of roleIds) await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      }
      if (permissionIds) {
        await connection.execute('DELETE FROM permissoes_utilizador WHERE user_id = ?', [userId]);
        for (const permissionId of permissionIds) await connection.execute('INSERT INTO permissoes_utilizador (user_id, permission_id) VALUES (?, ?)', [userId, permissionId]);
      }
      await writeAudit(connection, { actorId: request.user.id, action: 'USER_UPDATED', entity: 'user', entityId: userId, after: { active, roleIds, permissionIds }, ipAddress: request.ip });
    });
    response.json({ id: userId, message: 'Utilizador actualizado.' });
  } catch (error) { next(error); }
});

router.get('/users/:id/access', authorize('user.manage'), async (request, response, next) => {
  try {
    const userId = Number(request.params.id);
    if (!Number.isInteger(userId)) return response.status(422).json({ message: 'Utilizador inválido.' });
    const [[user]] = await pool.execute('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!user) return response.status(404).json({ message: 'Utilizador não encontrado.' });
    const [roles] = await pool.execute('SELECT role_id FROM user_roles WHERE user_id = ?', [userId]);
    const [permissions] = await pool.execute('SELECT permission_id FROM permissoes_utilizador WHERE user_id = ?', [userId]);
    response.json({ ...user, roleIds: roles.map((row) => row.role_id), permissionIds: permissions.map((row) => row.permission_id) });
  } catch (error) { next(error); }
});

router.get('/roles', authorize('role.manage'), async (request, response, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.code, r.name, GROUP_CONCAT(p.code ORDER BY p.code SEPARATOR ', ') AS permissions
       FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id GROUP BY r.id ORDER BY r.name`
    );
    response.json(rows);
  } catch (error) { next(error); }
});

router.get('/permissions', authorize('role.manage'), async (request, response, next) => {
  try { const [rows] = await pool.execute('SELECT id, code, description FROM permissions ORDER BY code'); response.json(rows); } catch (error) { next(error); }
});

router.post('/roles', authorize('role.manage'), async (request, response, next) => {
  try {
    const { code, name } = request.body;
    const permissionIds = Array.isArray(request.body.permissionIds) ? [...new Set(request.body.permissionIds.map(Number).filter(Number.isInteger))] : [];
    if (!/^[A-Z_]{3,60}$/.test(code || '') || !name?.trim()) return response.status(422).json({ message: 'Informe um código em maiúsculas (ex.: GESTOR) e o nome do perfil.' });
    if (!permissionIds.length) return response.status(422).json({ message: 'Seleccione pelo menos uma permissão para o perfil.' });
    const role = await inTransaction(async (connection) => {
      const [result] = await connection.execute('INSERT INTO roles (code, name) VALUES (?, ?)', [code, name.trim()]);
      for (const permissionId of permissionIds) await connection.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [result.insertId, permissionId]);
      await writeAudit(connection, { actorId: request.user.id, action: 'ROLE_CREATED', entity: 'role', entityId: result.insertId, after: { code, name: name.trim(), permissionIds }, ipAddress: request.ip });
      return { id: result.insertId, code, name: name.trim() };
    });
    response.status(201).json(role);
  } catch (error) { next(error); }
});

export default router;
