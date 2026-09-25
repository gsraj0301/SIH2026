import { Router } from 'express';
import { register, login } from '../controllers/authController.js';

const router = Router();

// Public endpoints — the ONLY ones not guarded by authenticate.
router.post('/register', register);
router.post('/login', login);

export default router;