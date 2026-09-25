import axios from 'axios';
import env from '../config/env.js';

// Thin HTTP wrapper around the teammate's voice microservice.
// This backend does NOT reimplement transcription or triage logic —
// it just ships the raw audio over and stores the returned verdict.
//
// The service returns its OWN internal shape (transcription as an object,
// symptoms as an array of objects, triage nested in `triage`, etc.).
// We NORMALIZE it here to the shape our API/schema expects
// ({ transcription, symptoms[], riskLevel, ttsResponse, audioUrl }).
// Adapting at the boundary is the correct contract between two
// independently-built services — neither side changes its internals.

// ── Typed errors ──────────────────────────────────────────────────────────
// Fringe cases must fail LOUD and SPECIFIC instead of silently miscasting:
//  - the pipeline rejected the audio (STT_FAILED, AUDIO_* ...)
//  - a fuzzy symptom match needs human confirmation (no triage in the payload)
//  - the pipeline could not pick a storable level (UNKNOWN)
// These are all "the recording was unclear" situations → HTTP 422, never 500.
// The central errorHandler maps err.status to the response status.

export class VoiceUnclearInputError extends Error {
  constructor(code, message, reason = null) {
    super(message);
    this.name = 'VoiceUnclearInputError';
    this.status = 422; // ask the ASHA worker to re-record
    this.code = code; // e.g. STT_FAILED, NEEDS_CONFIRMATION, UNKNOWN_LEVEL
    this.reason = reason; // optional detail (confirmation question, triage level, ...)
    this.expose = true; // surface the message to the app instead of masking it
  }
}

export class VoiceServiceUnreachableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VoiceServiceUnreachableError';
    this.status = 502; // downstream (voice service) is down — not the client's fault
    this.expose = true;
  }
}

// The only levels our Prisma RiskLevel enum can persist.
const STORABLE_LEVELS = new Set(['EMERGENCY', 'URGENT', 'ROUTINE', 'SELF_CARE']);

/**
 * POST an audio buffer to the voice pipeline and return a normalized result.
 *
 * @param {Buffer} buffer   raw audio bytes from multer memory storage
 * @param {string} filename original file name (useful for debug)
 * @param {string} mimetype audio content type (e.g. audio/webm)
 * @returns {Promise<{transcription: string, symptoms: string[], riskLevel: string, ttsResponse: string, audioUrl: string|null}>}
 * @throws {VoiceUnclearInputError}   422 — recording couldn't produce a storable verdict
 * @throws {VoiceServiceUnreachableError} 502 — the voice service is down
 */
export async function processVoiceAudio(buffer, filename, mimetype) {
  // Node >= 18 ships a global FormData — axios auto-sets the multipart boundary.
  const form = new FormData();
  form.append(
    'audio',
    new Blob([buffer], { type: mimetype || 'audio/webm' }),
    filename || 'recording.webm'
  );

  let data;
  try {
    const { data: body } = await axios.post(
      `${env.voiceServiceUrl}/api/v1/voice/process`,
      form,
      {
        timeout: 90000, // whisper-tiny on CPU is slow, and the FIRST call downloads the model
        validateStatus: () => true, // inspect status + body ourselves below
      }
    );
    data = body;
  } catch (err) {
    // Network-level failure (connection refused / DNS / timeout in our fetch).
    throw new VoiceServiceUnreachableError(`Voice service unreachable: ${err.message}`);
  }

  // Branch 1 — the pipeline itself rejected the audio.
  if (data?.success === false) {
    const code = data.error?.code || 'VOICE_ERROR';
    const detail = data.error?.message || 'No further detail provided';
    throw new VoiceUnclearInputError(
      code,
      `Voice service could not process the audio (${code}). Please re-record.`,
      { detail }
    );
  }

  // Branch 2 — a fuzzy symptom match needs confirmation BEFORE triage can run.
  // That payload carries a confirmation object and NO triage/response fields.
  if (data?.requiresConfirmation === true) {
    const question = data.confirmation?.questionHi || 'कृपया अपने लक्षण दोबारा बताएं।';
    throw new VoiceUnclearInputError(
      'NEEDS_CONFIRMATION',
      `Symptoms could not be confirmed. ${question}`,
      { question, concept: data.confirmation?.concept ?? null }
    );
  }

  // Branch 3 — triage level we cannot store (UNKNOWN or anything unexpected).
  // Fail loud and specific rather than saving an invalid enum value or crashing.
  const riskLevel = String(data?.triage?.level || '').toUpperCase();
  if (!STORABLE_LEVELS.has(riskLevel)) {
    throw new VoiceUnclearInputError(
      'UNKNOWN_LEVEL',
      `Voice service could not determine a triage level (got: "${riskLevel}"). Please re-record.`,
      { level: riskLevel }
    );
  }

  // Happy path — normalize the service's shape to the one our API/schema uses.
  const transcription = data?.transcription?.text || '';
  const symptoms = (data?.medical?.symptoms ?? []).map((s) => s.id).filter(Boolean);
  const ttsResponse = data?.response?.text || '';
  // The URL is returned relative (/api/v1/audio/x.wav) — resolve it to an
  // absolute one against the voice service so a client can play it directly.
  const audioUrl = data?.audio?.url ? `${env.voiceServiceUrl}${data.audio.url}` : null;

  return { transcription, symptoms, riskLevel, ttsResponse, audioUrl };
}