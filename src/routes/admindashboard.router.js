import express from 'express'
import { getAdminCount, getTodayTotalPoints } from '../controller/admindashboard.controller.js';

const router = express.Router();

router.get("/dashboard-details", getAdminCount);
router.get("/get-points", getTodayTotalPoints);

export default router;