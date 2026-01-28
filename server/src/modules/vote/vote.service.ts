import { prisma } from "../../lib/prisma";

export const voteTicket = async (
  ticketId: bigint,
  committeeId: bigint,
  vote: "approve" | "reject"
) => {
  return prisma.vote.create({
    data: {
      ticketId,
      committeeId,
      vote,
    },
  });
};
