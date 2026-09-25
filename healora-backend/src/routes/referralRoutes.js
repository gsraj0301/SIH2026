import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createReferral, listReferrals } from '../controllers/referralController.js';

const router = Router();

router.post('/', authenticate, createReferral);
router.get('/', authenticate, listReferrals);

export default router;