import prisma from '../config/db.js';
import {
  upsertLww,
  normalizeTriagePayload,
  normalizeAppointmentPayload,
} from '../services/syncService.js';

// POST /api/sync
// Body: { triageRecords: [...], appointments: [...] }
// The RN app queues records created offline and ships them in one batch once
// connectivity returns. Each record upserts with last-write-wins resolution.
export const syncOfflineData = async (req, res, next) => {
  try {
    const { triageRecords = [], appointments = [] } = req.body;

    const summary = {
      total: triageRecords.length + appointments.length,
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: [],
    };

    // --- Triage records (created offline, e.g. cached verdicts) ---
    for (const payload of triageRecords) {
      if (!payload.id) {
        summary.errors.push({ type: 'triageRecord', error: 'missing id' });
        continue;
      }
      try {
        const { action } = await upsertLww(
          prisma.triageRecord,
          payload.id,
          normalizeTriagePayload(payload)
        );
        tallyActionResult(summary, action);
      } catch (err) {
        summary.errors.push({ type: 'triageRecord', id: payload.id, error: err.message });
      }
    }

    // --- Appointments (created offline) ---
    for (const payload of appointments) {
      if (!payload.id || !payload.doctorId) {
        summary.errors.push({
          type: 'appointment',
          id: payload.id,
          error: payload.doctorId ? 'missing id' : 'missing doctorId (offline appointments must pre-match a doctor)',
        });
        continue;
      }
      try {
        const { action } = await upsertLww(
          prisma.appointment,
          payload.id,
          normalizeAppointmentPayload(payload)
        );
        tallyActionResult(summary, action);
      } catch (err) {
        summary.errors.push({ type: 'appointment', id: payload.id, error: err.message });
      }
    }

    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
};

// Local helper: convert an upsert action into summary counters.
function tallyActionResult(summary, action) {
  if (action === 'created') summary.created += 1;
  else if (action === 'updated') summary.updated += 1;
  else if (action === 'conflict_server_wins') summary.conflicts += 1;
}