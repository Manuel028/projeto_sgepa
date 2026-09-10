import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/database.js';

const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error('Defina ADMIN_PASSWORD no ficheiro .env antes de executar este comando.');

const hash = await bcrypt.hash(password, 12);
const [result] = await pool.execute(
  `INSERT INTO users (name, email, username, password_hash, active) VALUES (?, ?, ?, ?, TRUE)
   ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), active = TRUE`,
  ['Administrador SGEPA', process.env.ADMIN_EMAIL || 'admin@sgepa.local', process.env.ADMIN_USERNAME || 'admin', hash]
);
const [users] = await pool.execute('SELECT id FROM users WHERE username = ?', [process.env.ADMIN_USERNAME || 'admin']);
const [roles] = await pool.execute("SELECT id FROM roles WHERE code = 'ADMIN'");
await pool.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [users[0].id, roles[0].id]);
console.log(`Administrador preparado (id: ${result.insertId || users[0].id}).`);
await pool.end();

