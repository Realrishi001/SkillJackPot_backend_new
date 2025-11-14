import express from "express";
import { blockOrUnblockShop, getAdminsBlockStatus, getSingleAdminBlockStatus } from "../controller/blockAdmins.controller.js";

const router = express.Router();

// Controller 1 → Block or Unblock
router.post("/block-shop", blockOrUnblockShop);

// Controller 2 → Get all admin block info
router.get("/blocked-admins", getAdminsBlockStatus);

router.post("/check-blocked",getSingleAdminBlockStatus);

export default router;
