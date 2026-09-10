import { Router } from 'express';
import { pool } from '../database.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();
router.use(authenticate);

router.get('/departments', async (request, response, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM departments WHERE active = TRUE ORDER BY name');
    response.json(rows);
  } catch (error) { next(error); }
});

router.get('/users', authorize('archive.manage'), async (request, response, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, username FROM users WHERE active = TRUE ORDER BY name');
    response.json(rows);
  } catch (error) { next(error); }
});

export default router;
