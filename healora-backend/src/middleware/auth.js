import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const ROLES = { ASHA: 'ASHA', DOCTOR: 'DOCTOR' };

export function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if(!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
 const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

}

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};