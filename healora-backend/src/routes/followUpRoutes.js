import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { listFollowUps, completeFollowUp } from '../controllers/followUpController.js';

const router = Router();

router.get('/', authenticate, listFollowUps);
router.patch('/:id/complete', authenticate, completeFollowUp);

export default router;