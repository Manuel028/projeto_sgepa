import { Router } from 'express';
import { pool } from '../database.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { inTransaction } from '../database.js';
import { writeAudit } from '../services/audit-service.js';

const router = Router();
router.use(authenticate, authorize('audit.read'));

router.get('/', async (request, response, next) => {
  try {
    const conditions = [];
    const values = [];
    if (request.query.action) { conditions.push('a.action = ?'); values.push(request.query.action); }
    if (request.query.entity) { conditions.push('a.entity = ?'); values.push(request.query.entity); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(request.query.dateFrom || '')) { conditions.push('a.created_at >= ?'); values.push(`${request.query.dateFrom} 00:00:00`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(request.query.dateTo || '')) { conditions.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(request.query.dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.after_data, a.ip_address, a.created_at, u.name AS actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${where}
       ORDER BY a.created_at DESC LIMIT 200`, values
    );
    response.json(rows);
  } catch (error) { next(error); }
});

router.delete('/access-history', authorize('audit.manage'), async (request, response, next) => {
  try {
    const result = await inTransaction(async (connection) => {
      const [deleted] = await connection.execute("DELETE FROM audit_logs WHERE action = 'LOGIN_SUCCEEDED'");
      await writeAudit(connection, { actorId: request.user.id, action: 'ACCESS_HISTORY_DELETED', entity: 'audit_log', after: { deleted: deleted.affectedRows }, ipAddress: request.ip });
      return deleted.affectedRows;
    });
    response.json({ deleted: result, message: 'Histórico de acessos eliminado com sucesso.' });
  } catch (error) { next(error); }
});

export default router;
