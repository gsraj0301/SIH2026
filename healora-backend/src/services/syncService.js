import prisma from '../config/db.js';

// Last-write-wins (LWW) upsert used by the offline sync endpoint.
//
// Rule: compare the client's updatedAt (or createdAt) against what we have.
//   - no record yet         → create it
//   - incoming is newer     → overwrite server copy
//   - incoming is older     → conflict, keep server copy (server wins)
//
// Why LWW? Rural ASHA workers often have flaky connectivity and two devices
// rarely edit the same record. LWW is the simplest correct strategy and is
// easy to explain on stage.

const earliest = (record) => {
  const ts = record.updatedAt || record.createdAt;
  return ts ? new Date(ts).getTime() : 0;
};

/**
 * Upsert `data` (with id) against `model` using last-write-wins.
 * @returns {Promise<{action: 'created'|'updated'|'conflict_server_wins', record}>}
 */
export async function upsertLww(model, id, data) {
  // NOTE: do NOT set data.synced here — only TriageRecord has a `synced`
  // column. normalizeTriagePayload() already flags synced:true for triage
  // records; Appointment has no such field.
  const existing = await model.findUnique({ where: { id } });

  if (!existing) {
    const record = await model.create({ data });
    return { action: 'created', record };
  }

  if (earliest(data) < earliest(existing)) {
    return { action: 'conflict_server_wins', record: existing };
  }

  const record = await model.update({ where: { id }, data });
  return { action: 'updated', record };
}

/**
 * Normalize an offline TriageRecord payload to our schema field names.
 * The app stores records created offline; the client may send any casing.
 */
export function normalizeTriagePayload(payload = {}) {
  return {
    id: payload.id,
    patientId: payload.patientId,
    ashaWorkerId: payload.ashaWorkerId,
    transcription: payload.transcription || '',
    symptoms: payload.symptoms || [],
    riskLevel: (payload.riskLevel || payload.triage_level || 'ROUTINE').toUpperCase(),
    synced: true,
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
  };
}

/**
 * Normalize an offline Appointment payload. doctorId is required —
 * offline-created appointments must already carry a matched doctor id.
 */
export function normalizeAppointmentPayload(payload = {}) {
  return {
    id: payload.id,
    patientId: payload.patientId,
    doctorId: payload.doctorId,
    ashaWorkerId: payload.ashaWorkerId,
    scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : new Date(),
    status: (payload.status || 'PENDING').toUpperCase(),
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
  };
}