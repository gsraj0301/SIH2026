import prisma from '../config/db.js';

// POST /api/patients  → create a patient record
export const createPatient = async (req, res, next) => {
  try {
    const { name, age, gender, phone, village } = req.body;

    if (!name || !age || !gender || !village) {
      return res
        .status(400)
        .json({ success: false, error: 'name, age, gender and village are required' });
    }

    const patient = await prisma.patient.create({
      data: { name, age: Number(age), gender, phone: phone || null, village },
    });

    res.status(201).json({ success: true, patient });
  } catch (error) {
    next(error); // central error handler catches it — never crash the server
  }
};

// GET /api/patients/:id → single patient with their clinical history
export const getPatientById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // include pulls in the patient's past triages + follow-ups so the
    // ASHA dashboard has history in one round trip.
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        triageRecords: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    res.json({ success: true, patient });
  } catch (error) {
    next(error);
  }
};

// GET /api/patients?ashaWorkerId=xxx → list patients, filterable by worker
export const listPatients = async (req, res, next) => {
  try {
    const { ashaWorkerId } = req.query;

    // NOTE: Patient has no direct FK to AshaWorker. The link exists only
    // through TriageRecord, so we filter the relation:
    //   "patients who have AT LEAST ONE triage record by this worker"
    const patients = await prisma.patient.findMany({
      where: ashaWorkerId
        ? { triageRecords: { some: { ashaWorkerId } } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: { triageRecords: { orderBy: { createdAt: 'desc' } } },
    });

    res.json({ success: true, patients });
  } catch (error) {
    next(error);
  }
};