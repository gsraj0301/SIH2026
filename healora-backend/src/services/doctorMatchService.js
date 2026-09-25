import prisma from '../config/db.js';

// Maps extracted symptom tags to a specialist type.
// Simple keyword scoring — good enough for a demo, easy to explain.
const SPECIALTY_MAP = [
  {
    specialty: 'General Physician',
    keywords: [
      'fever', 'cough', 'cold', 'headache', 'body ache', 'body pain',
      'weakness', 'vomiting', 'diarrhoea', 'diarrhea', 'stomach',
      'abdominal pain', 'back pain', 'flu', 'throat',
    ],
  },
  {
    specialty: 'Gynecologist',
    keywords: [
      'pregnancy', 'pregnant', 'menstrual', 'period', 'uterus',
      'labor', 'delivery', 'postnatal', 'uterus', 'gynae',
    ],
  },
  {
    specialty: 'Pediatrician',
    keywords: [
      'child', 'baby', 'infant', 'newborn', 'kid', 'vaccination', 'vaccine',
    ],
  },
  {
    specialty: 'Cardiologist',
    keywords: [
      'chest pain', 'chest', 'heart', 'palpitation', 'bp', 'blood pressure',
      'cardiac', 'breathless', 'shortness of breath', 'breathing difficulty',
    ],
  },
];

/**
 * Pick the specialty with the most keyword hits for the given symptoms.
 * Defaults to General Physician when nothing matches.
 */
export function suggestSpecialty(symptoms = []) {
  // The voice service EXTRACTS symptoms as snake_case concept ids ("chest_pain",
  // "breathing_difficulty"), so normalize underscores/hyphens into spaces before
  // keyword scoring — else "chest pain" would never match the id "chest_pain"
  // and chest cases would fall through to a General Physician (verified bug).
  const text = symptoms.join(' ').toLowerCase().replace(/[_-]/g, ' ');
  let best = 'General Physician';
  let bestHits = 0;

  for (const entry of SPECIALTY_MAP) {
    const hits = entry.keywords.filter((keyword) => text.includes(keyword)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = entry.specialty;
    }
  }
  return best;
}

/**
 * Find available doctors that match the symptoms.
 * Queries the MOCK doctor directory — no external directory integration.
 */
export async function findMatchingDoctors(symptoms = [], riskLevel) {
  const specialty = suggestSpecialty(symptoms);

  // riskLevel can tighten the search — EMERGENCY cases should go to the
  // highest available facility type (District > CHC > PHC).
  const facilityRank = { EMERGENCY: ['District'], URGENT: ['District', 'CHC'], ROUTINE: ['CHC', 'PHC'], SELF_CARE: ['PHC'] };
  const allowedFacilities = facilityRank[riskLevel] || facilityRank.ROUTINE;

  const doctors = await prisma.doctor.findMany({
    where: {
      specialty,
      available: true,
      facilityType: { in: allowedFacilities },
    },
  });

  return { specialty, doctors };
}

/**
 * Generate candidate appointment slots (next N mornings, 10:00 AM).
 * The ASHA worker picks/confirms one before the appointment is confirmed.
 */
export function suggestSlots(count = 3, now = new Date()) {
  const slots = [];
  for (let i = 1; i <= count; i++) {
    const slot = new Date(now);
    slot.setDate(slot.getDate() + i);
    slot.setHours(10, 0, 0, 0); // demo: fixed morning clinic time
    slots.push(slot);
  }
  return slots;
}