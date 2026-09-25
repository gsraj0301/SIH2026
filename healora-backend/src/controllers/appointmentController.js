import prisma from '../config/db.js';
import { findMatchingDoctors, suggestSlots } from '../services/doctorMatchService.js';

// GET /api/appointments?ashaWorkerId=&patientId=&status=
// Powers "My Appointments" (listing by worker) and the patient profile's
// appointment section (listing by patient). Same filterable-list pattern as
// listPatients / listFollowUps.
export const listAppointments = async (req, res, next) => {
  try {
    const { ashaWorkerId, patientId, status } = req.query;

    const where = {
      ...(ashaWorkerId ? { ashaWorkerId } : {}),
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
    };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: { doctor: true, patient: true },
    });

    res.json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    next(error); // central error handler catches it — never crash the server
  }
};

// POST /api/appointments
// Body: { patientId, symptoms: string[], riskLevel, scheduledFor? }
// Matches a doctor from the mock directory and books a PENDING appointment.
// `scheduledFor` (ISO string) lets the ASHA worker pick one of the 3 suggested
// slots; when omitted the first suggested slot is used.
export const createAppointment = async (req, res, next) => {
  try {
    const { patientId, symptoms = [], riskLevel, scheduledFor } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    if (scheduledFor !== undefined && Number.isNaN(new Date(scheduledFor).getTime())) {
      return res.status(400).json({ success: false, error: 'scheduledFor must be a valid ISO date' });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Symptom tags (from the triage) drive the specialist match.
    const match = await findMatchingDoctors(symptoms, riskLevel);
    if (match.doctors.length === 0) {
      return res.status(409).json({
        success: false,
        error: `No available ${match.specialty} at ${riskLevel || 'ROUTINE'} level`,
      });
    }

    const doctor = match.doctors[0];
    const suggestedSlots = suggestSlots();

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        ashaWorkerId: req.user.id,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : suggestedSlots[0],
        status: 'PENDING',
      },
      include: { doctor: true, patient: true },
    });

    // Return the candidate so the ASHA worker can confirm/adjust the slot.
    res.status(201).json({ success: true, appointment, matchedDoctor: doctor, suggestedSlots });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/appointments/:id/confirm → status PENDING ➜ CONFIRMED
export const confirmAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { doctor: true, patient: true },
    });

    res.json({ success: true, appointment });
  } catch (error) {
    next(error);
  }
};