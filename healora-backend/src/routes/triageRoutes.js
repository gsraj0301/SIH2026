import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { runTriage, uploadAudio } from '../controllers/triageController.js';

const router = Router();

// Multipart upload: the route unwraps the audio via multer, then runTriage
// forwards it to the voice microservice and stores the result.
router.post('/', authenticate, uploadAudio, runTriage);

export default router;