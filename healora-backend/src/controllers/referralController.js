import prisma from '../config/db.js';

// POST /api/referrals
// Creates a referral. The triage flow auto-triggers this for EMERGENCY/URGENT,
// but ASHA workers can also create one manually from the app.
export const createReferral = async (req, res, next) => {
  try {
    const { patientId, fromFacility, toFacility, reason } = req.body;

    if (!patientId || !toFacility || !reason) {
      return res.status(400).json({
        success: false,
        error: 'patientId, toFacility and reason are required',
      });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const referral = await prisma.referral.create({
      data: {
        patientId,
        fromFacility: fromFacility || `${patient.village} Health Center`,
        toFacility,
        reason,
      },
      include: { patient: true },
    });

    res.status(201).json({ success: true, referral });
  } catch (error) {
    next(error);
  }
};

// GET /api/referrals?patientId=xxx → list referrals, filterable by patient
export const listReferrals = async (req, res, next) => {
  try {
    const { patientId } = req.query;

    const referrals = await prisma.referral.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    });

    res.json({ success: true, referrals });
  } catch (error) {
    next(error);
  }
};