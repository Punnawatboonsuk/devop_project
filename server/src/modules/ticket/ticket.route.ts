import { Router } from "express";
import * as controller from "./ticket.controller";
import { auth } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/role.middleware";

const router = Router();

router.post("/", auth, allowRoles(["STUDENT"]), controller.create);
router.get("/me", auth, allowRoles(["STUDENT"]), controller.myTickets);

router.get("/", auth, allowRoles(["STAFF", "DEAN", "SUB_DEAN", "ADMIN"]), controller.list);
router.get("/:id", auth, controller.detail);

router.patch("/:id/accept", auth, allowRoles(["STAFF", "DEAN", "SUB_DEAN"]), controller.accept);
router.patch("/:id/reject", auth, allowRoles(["STAFF", "DEAN", "SUB_DEAN"]), controller.reject);

export default router;
