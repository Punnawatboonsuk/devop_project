import * as service from "./vote.service";

export const vote = async (req, res) => {
  const result = await service.voteTicket(
    BigInt(req.body.ticketId),
    BigInt(req.user.id),
    req.body.vote
  );
  res.json(result);
};
