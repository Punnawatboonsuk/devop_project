import { prisma } from "../../lib/prisma";

export const getDashboard = async (userId: bigint) => {
  const total = await prisma.ticket.count({ where: { userId } });
  const approved = await prisma.ticket.count({
    where: { userId, status: "approved" },
  });
  const rejected = await prisma.ticket.count({
    where: { userId, status: "reject" },
  });

  return { total, approved, rejected };
};
