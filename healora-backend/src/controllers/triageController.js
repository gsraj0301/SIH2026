import multer from 'multer';
import prisma from '../config/db.js';
import { processVoiceAudio } from '../services/voicePipelineClient.js';

// Keep the audio in memory — payloads are small and we only forward them on.
// 15MB is generous for a few minutes of speech in any codec.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const uploadAudio = upload.single('audio');

// POST /api/triage  (multipart: audio file + patientId)
// Core integration: forward audio → voice service → store verdict → auto-referral.
export const runTriage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'audio file is required (field name: audio)' });
    }

    const patientId = req.body.patientId;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // 1. Hand the raw audio to the teammate's microservice. It returns the
    //    transcription, extracted symptoms and a triage verdict (which we
    //    intentionally do NOT reimplement here).
    //
    //    The client NORMALIZES the service's shape and guarantees riskLevel is
    //    one of our four storable enum values — anything unclear (STT failure,
    //    fuzzy needs-confirmation, UNKNOWN level) is thrown as a clean 422
    //    (VoiceUnclearInputError) and funneled to the central error handler,
    //    so no invalid verdict ever reaches the DB.
    const { transcription, symptoms, riskLevel, ttsResponse, audioUrl } = await processVoiceAudio(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // 2. Persist the verdict, linked to the patient and the logged-in worker.
    const triageRecord = await prisma.triageRecord.create({
      data: {
        patientId,
        ashaWorkerId: req.user.id,
        transcription,
        symptoms,
        riskLevel,
      },
    });

    // 3. High-risk cases auto-trigger a referral to a higher facility.
    let autoReferral = null;
    if (riskLevel === 'EMERGENCY' || riskLevel === 'URGENT') {
      autoReferral = await prisma.referral.create({
        data: {
          patientId,
          fromFacility: `${patient.village} Health Center`,
          toFacility: riskLevel === 'EMERGENCY' ? 'District Hospital' : 'Community Health Centre (CHC)',
          reason: `Auto-referral after ${riskLevel} triage: ${symptoms.join(', ') || 'unspecified'}`,
        },
      });
    }

    res.status(201).json({
      success: true,
      triageRecord,
      ttsResponse, // text-to-speech reply for the ASHA worker to hear
      audioUrl,    // absolute URL of the voice service's TTS audio clip (playable by the app)
      riskLevel,
      autoReferral,
    });
  } catch (error) {
    next(error);
  }
};