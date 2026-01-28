import * as service from "./ticket.service";

export const create = async (req, res) => {
  const userId = BigInt(req.user.id);
  const ticket = await service.createTicket({
    userId,
    awardTypeId: BigInt(req.body.awardTypeId),
    academicYear: req.body.academicYear,
    semester: req.body.semester,
    status: "draft",
    formData: req.body.formData,
  });
  res.json(ticket);
};

export const myTickets = async (req, res) => {
  const tickets = await service.getMyTickets(BigInt(req.user.id));
  res.json(tickets);
};

export const list = async (req, res) => {
  const tickets = await service.getAllTickets();
  res.json(tickets);
};

export const detail = async (req, res) => {
  const ticket = await service.getTicketById(BigInt(req.params.id));
  res.json(ticket);
};

export const accept = async (req, res) => {
  const ticket = await service.updateStatus(
    BigInt(req.params.id),
    "approved"
  );
  res.json(ticket);
};

export const reject = async (req, res) => {
  const ticket = await service.updateStatus(
    BigInt(req.params.id),
    "reject"
  );
  res.json(ticket);
};
