import prisma from '../config/db.js';

// GET /api/followups?dueToday=true
// Powers the ASHA dashboard badge: "X follow-ups due today".
export const listFollowUps = async (req, res, next) => {
  try {
    const dueToday = req.query.dueToday === 'true';

    let where = undefined;
    if (dueToday) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      where = { dueDate: { gte: start, lt: end }, status: 'PENDING' };
    }

    const followUps = await prisma.followUp.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: { patient: true },
    });

    res.json({ success: true, count: followUps.length, followUps });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/followups/:id/complete → status PENDING ➜ DONE
export const completeFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Follow-up not found' });
    }

    const followUp = await prisma.followUp.update({
      where: { id },
      data: { status: 'DONE' },
      include: { patient: true },
    });

    res.json({ success: true, followUp });
  } catch (error) {
    next(error);
  }
};