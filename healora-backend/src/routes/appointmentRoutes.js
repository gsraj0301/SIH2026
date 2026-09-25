import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createAppointment,
  confirmAppointment,
  listAppointments,
} from '../controllers/appointmentController.js';

const router = Router();

router.get('/', authenticate, listAppointments);
router.post('/', authenticate, createAppointment);
router.patch('/:id/confirm', authenticate, confirmAppointment);

export default router;