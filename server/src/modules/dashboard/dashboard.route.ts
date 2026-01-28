import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/role.middleware";
import { dashboard } from "./dashboard.controller";

const router = Router();

router.get("/", auth, allowRoles(["STUDENT"]), dashboard);

export default router;
