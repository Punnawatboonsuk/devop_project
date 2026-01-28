import * as service from "./dashboard.service";

export const dashboard = async (req, res) => {
  const data = await service.getDashboard(BigInt(req.user.id));
  res.json(data);
};
