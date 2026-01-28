import { prisma } from "../../lib/prisma";
import { TicketStatus } from "@prisma/client";

export const createTicket = async (data) => {
  return prisma.ticket.create({ data });
};

export const getMyTickets = async (userId: bigint) => {
  return prisma.ticket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const getAllTickets = async () => {
  return prisma.ticket.findMany({
    include: { user: true, votes: true },
  });
};

export const getTicketById = async (id: bigint) => {
  return prisma.ticket.findUnique({
    where: { id },
    include: { user: true, votes: true },
  });
};

export const updateStatus = async (id: bigint, status: TicketStatus) => {
  return prisma.ticket.update({
    where: { id },
    data: { status },
  });
};
