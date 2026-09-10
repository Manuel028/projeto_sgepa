import 'dotenv/config';
import path from 'node:path';

const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`A variável de ambiente ${key} é obrigatória.`);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5500',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || ''
  }
};

