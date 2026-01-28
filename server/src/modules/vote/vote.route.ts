import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/role.middleware";
import { vote } from "./vote.controller";

const router = Router();

router.post("/", auth, allowRoles(["COMMITTEE", "COMMITTEE_PRESIDENT"]), vote);

export default router;
