import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import membersRouter from "./members";
import profileRouter from "./profile";
import habitsRouter from "./habits";
import churchRouter from "./church";
import stellarboardRouter from "./stellarboard";
import ministryRouter from "./ministry";
import adminRouter from "./admin";
import groupsRouter from "./groups";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(membersRouter);
router.use(profileRouter);
router.use(habitsRouter);
router.use(churchRouter);
router.use(stellarboardRouter);
router.use(ministryRouter);
router.use(adminRouter);
router.use(groupsRouter);
router.use(storageRouter);

export default router;
