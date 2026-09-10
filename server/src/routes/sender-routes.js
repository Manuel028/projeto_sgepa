import { Router } from 'express';
import { pool } from '../database.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { writeAudit } from '../services/audit-service.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('sender.read'), async (request, response, next) => {
  try {
    const search = request.query.search || '';
    const [rows] = await pool.execute('SELECT id, name, type, identification, contact FROM senders WHERE name LIKE ? ORDER BY name LIMIT 50', [`%${search}%`]);
    response.json(rows);
  } catch (error) { next(error); }
});

router.post('/', authorize('sender.create'), async (request, response, next) => {
  try {
    const { name, type, identification, contact, address, institution } = request.body;
    if (!name || !type) return response.status(422).json({ message: 'Nome e tipo são obrigatórios.' });
    const [result] = await pool.execute(
      'INSERT INTO senders (name, type, identification, contact, address, institution) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, identification || null, contact || null, address || null, institution || null]
    );
    await writeAudit(pool, { actorId: request.user.id, action: 'SENDER_CREATED', entity: 'sender', entityId: result.insertId, after: { name, type }, ipAddress: request.ip });
    response.status(201).json({ id: result.insertId, name, type });
  } catch (error) { next(error); }
});

export default router;
