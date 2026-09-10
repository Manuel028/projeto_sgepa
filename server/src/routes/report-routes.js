import { Router } from 'express';
import { pool } from '../database.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();
router.use(authenticate, authorize('report.read'));

router.get('/overview', async (request, response, next) => {
  try {
    const [byState, byDepartment, overdueLoans] = await Promise.all([
      pool.execute('SELECT state, COUNT(*) AS total FROM processes GROUP BY state ORDER BY state'),
      pool.execute(`SELECT COALESCE(d.name, 'Sem departamento') AS name, COUNT(*) AS total FROM processes p LEFT JOIN departments d ON d.id = p.current_department_id GROUP BY d.id, d.name ORDER BY total DESC`),
      pool.execute(`SELECT l.id, p.number, p.subject, u.name AS requester_name, l.due_at FROM archive_loans l JOIN processes p ON p.id = l.process_id JOIN users u ON u.id = l.requester_id WHERE l.returned_at IS NULL AND l.due_at < CURRENT_TIMESTAMP ORDER BY l.due_at`)
    ]);
    response.json({ byState: byState[0], byDepartment: byDepartment[0], overdueLoans: overdueLoans[0] });
  } catch (error) { next(error); }
});

export default router;
