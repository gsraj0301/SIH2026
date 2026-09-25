import bcrypt from 'bcryptjs';
import prisma from '../src/config/db.js';

// Seed script — run with: npm run seed
// Populates the MOCK doctor directory, a demo ASHA worker, sample patients,
// plus a few triage/referral/follow-up records so every screen has data on day one.
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

// Load env for DATABASE_URL before Prisma connects.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Keep ids stable across re-runs so the seed is idempotent for demo patients.
const P = {
  patientA: '00000000-0000-4000-8000-000000000001',
  patientB: '00000000-0000-4000-8000-000000000002',
  patientC: '00000000-0000-4000-8000-000000000003',
  patientD: '00000000-0000-4000-8000-000000000004',
  triageA:  '10000000-0000-4000-8000-000000000001',
  triageB:  '10000000-0000-4000-8000-000000000002',
  referralA:'20000000-0000-4000-8000-000000000001',
  fuA:      '30000000-0000-4000-8000-000000000001',
  fuB:      '30000000-0000-4000-8000-000000000002',
  fuC:      '30000000-0000-4000-8000-000000000003',
};

const main = async () => {
  console.log('🌱 Seeding Healora database...');

  // ---------- Demo ASHA worker ----------
  const demoPhone = '9999999999';
  const passwordHash = await bcrypt.hash('asha123', 10);
  const worker = await prisma.ashaWorker.upsert({
    where: { phone: demoPhone },
    // Self-healing: if the row already exists with a stale/wrong hash (e.g. from
    // an earlier seed or manual edit), re-running `npm run seed` repairs it so the
    // demo login 9999999999 / asha123 always works.
    update: { name: 'Sunita Devi (Demo ASHA)', passwordHash, village: 'Kishangarh' },
    create: {
      name: 'Sunita Devi (Demo ASHA)',
      phone: demoPhone,
      passwordHash,
      village: 'Kishangarh',
    },
  });
  console.log(`  ↳ ASHA worker: ${worker.name} (login: ${demoPhone} / asha123)`);

  // ---------- Mock doctors (8) ----------
  const doctors = [
    { name: 'Dr. Ramesh Kumar', specialty: 'General Physician', facilityName: 'Kishangarh PHC', facilityType: 'PHC' },
    { name: 'Dr. Meena Sharma', specialty: 'General Physician', facilityName: 'Kishangarh PHC', facilityType: 'PHC' },
    { name: 'Dr. Arjun Patel', specialty: 'General Physician', facilityName: 'Bhilwara CHC', facilityType: 'CHC' },
    { name: 'Dr. Kavita Joshi', specialty: 'Gynecologist', facilityName: 'Bhilwara CHC', facilityType: 'CHC' },
    { name: 'Dr. Anita Rao', specialty: 'Gynecologist', facilityName: 'Bhilwara District Hospital', facilityType: 'District' },
    { name: 'Dr. Suresh Verma', specialty: 'Pediatrician', facilityName: 'Kishangarh PHC', facilityType: 'PHC' },
    { name: 'Dr. Nisha Gupta', specialty: 'Pediatrician', facilityName: 'Bhilwara CHC', facilityType: 'CHC' },
    { name: 'Dr. Vikram Singh', specialty: 'Cardiologist', facilityName: 'Bhilwara District Hospital', facilityType: 'District' },
    { name: 'Dr. Farhan Ali', specialty: 'Cardiologist', facilityName: 'Jaipur SDH', facilityType: 'CHC' },
  ];

  for (const d of doctors) {
    // Idempotent insert: `Doctor` has no natural unique key, so re-running the
    // seed would duplicate rows. Match by name and only create if absent.
    const existing = await prisma.doctor.findFirst({ where: { name: d.name } });
    if (!existing) {
      await prisma.doctor.create({ data: d });
    }
  }
  console.log(`  ↳ ${doctors.length} mock doctors seeded`);

  // ---------- Sample patients ----------
  const patients = [
    { id: P.patientA, name: 'Rukmini Bai', age: 58, gender: 'Female', phone: '9876500001', village: 'Kishangarh' },
    { id: P.patientB, name: 'Mohammed Irfan', age: 34, gender: 'Male', phone: '9876500002', village: 'Kishangarh' },
    { id: P.patientC, name: 'Lakshmi Devi', age: 26, gender: 'Female', phone: null, village: 'Sahapur' },
    { id: P.patientD, name: 'Gopal Charan', age: 5, gender: 'Male', phone: '9876500003', village: 'Sahapur' },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }
  console.log(`  ↳ ${patients.length} sample patients seeded`);

  // ---------- Demo clinical records ----------
  await prisma.triageRecord.upsert({
    where: { id: P.triageA },
    update: {},
    create: {
      id: P.triageA,
      patientId: P.patientA,
      ashaWorkerId: worker.id,
      transcription: 'Patient reports fever since two days and severe headache.',
      symptoms: ['fever', 'headache', 'weakness'],
      riskLevel: 'ROUTINE',
      synced: true,
    },
  });

  await prisma.triageRecord.upsert({
    where: { id: P.triageB },
    update: {},
    create: {
      id: P.triageB,
      patientId: P.patientB,
      ashaWorkerId: worker.id,
      transcription: 'Patient has chest pain and shortness of breath after walking.',
      symptoms: ['chest pain', 'breathlessness'],
      riskLevel: 'URGENT',
      synced: true,
    },
  });

  await prisma.referral.upsert({
    where: { id: P.referralA },
    update: {},
    create: {
      id: P.referralA,
      patientId: P.patientB,
      fromFacility: 'Kishangarh Health Center',
      toFacility: 'Bhilwara District Hospital',
      reason: 'Suspected cardiac event — urgent cardiology review.',
    },
  });

  // A follow-up due TODAY so the dashboard badge is non-zero during the demo.
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await prisma.followUp.upsert({
    where: { id: P.fuA },
    update: {},
    create: { id: P.fuA, patientId: P.patientA, dueDate: today, reason: 'Fever review — check temperature pattern', status: 'PENDING' },
  });
  await prisma.followUp.upsert({
    where: { id: P.fuB },
    update: {},
    create: { id: P.fuB, patientId: P.patientC, dueDate: tomorrow, reason: 'Antenatal check reminder', status: 'PENDING' },
  });
  await prisma.followUp.upsert({
    where: { id: P.fuC },
    update: {},
    create: { id: P.fuC, patientId: P.patientD, dueDate: nextWeek, reason: 'Vaccination booster due', status: 'PENDING' },
  });

  console.log('  ↳ demo triage records, referral and follow-ups seeded');
  console.log('✅ Seed complete');
};

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });