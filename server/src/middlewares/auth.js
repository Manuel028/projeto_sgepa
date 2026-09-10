import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticate(request, response, next) {
  const header = request.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return response.status(401).json({ message: 'Autenticação obrigatória.' });
  }

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }
}

export function authorize(...permissions) {
  return (request, response, next) => {
    const granted = request.user.permissions || [];
    if (permissions.some((permission) => granted.includes(permission))) {
      return next();
    }
    return response.status(403).json({ message: 'Não possui permissão para esta operação.' });
  };
}

