import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncOfflineData } from '../controllers/syncController.js';

const router = Router();

router.post('/', authenticate, syncOfflineData);

export default router;