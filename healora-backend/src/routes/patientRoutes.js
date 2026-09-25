import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createPatient, getPatientById, listPatients } from '../controllers/patientController.js';

const router = Router();

// Patient routes are guarded — only authenticated ASHA workers get in.
router.post('/', authenticate, createPatient);
router.get('/:id', authenticate, getPatientById);
router.get('/', authenticate, listPatients);

export default router;