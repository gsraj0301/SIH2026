import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import env from '../config/env.js';

// Small helper: wraps the role + id into a signed 7-day token.
const signToken = (id, role) =>
  jwt.sign({ id, role }, env.jwtSecret, { expiresIn: '7d' });

// POST /api/auth/register  → ASHA worker signup
export const register = async (req, res, next) => {
  try {
    const { name, phone, password, village } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, error: 'name, phone and password are required' });
    }

    const exists = await prisma.ashaWorker.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ success: false, error: 'Phone already registered' });

    const passwordHash = await bcrypt.hash(password, 10);

    const worker = await prisma.ashaWorker.create({
      data: { name, phone, passwordHash, village },
      select: { id: true, name: true, phone: true, village: true, createdAt: true },
    });

    // Mint the token and hand it straight back.
    const token = signToken(worker.id, 'ASHA');
    res.status(201).json({ success: true, token, worker });
  } catch (error) {
    next(error); // ← central handler catches it. NEVER crash the server.
  }
};

// POST /api/auth/login  → verify password, return JWT
export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, error: 'phone and password are required' });
    }

    const worker = await prisma.ashaWorker.findUnique({ where: { phone } });
    if (!worker) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, worker.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = signToken(worker.id, 'ASHA');
    res.json({ success: true, token, worker: { id: worker.id, name: worker.name, phone: worker.phone, village: worker.village } });
  } catch (error) {
    next(error);
  }
};