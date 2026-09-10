import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database.js';
import { config } from '../config.js';
import { writeAudit } from '../services/audit-service.js';

const router = Router();

router.post('/login', async (request, response, next) => {
  try {
    const { login, password } = request.body;
    if (!login || !password) return response.status(422).json({ message: 'Informe utilizador/e-mail e palavra-passe.' });
    const [users] = await pool.execute(
      `SELECT id, name, email, username, password_hash FROM users
       WHERE active = TRUE AND (email = ? OR username = ?) LIMIT 1`, [login, login]
    );
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const [permissionRows] = await pool.execute(
      `SELECT DISTINCT code FROM (
         SELECT p.code AS code FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ?
         UNION
         SELECT p.code AS code FROM permissions p
         JOIN permissoes_utilizador pu ON pu.permission_id = p.id WHERE pu.user_id = ?
       ) AS permissoes`, [user.id, user.id]
    );
    const [roleRows] = await pool.execute(
      `SELECT r.code, r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.name`, [user.id]
    );
    const permissions = permissionRows.map((permission) => permission.code);
    await writeAudit(pool, { actorId: user.id, action: 'LOGIN_SUCCEEDED', entity: 'user', entityId: user.id, after: { username: user.username }, ipAddress: request.ip });
    const token = jwt.sign({ id: user.id, name: user.name, permissions }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    return response.json({ token, user: { id: user.id, name: user.name, email: user.email, permissions, roles: roleRows } });
  } catch (error) { return next(error); }
});

export default router;
