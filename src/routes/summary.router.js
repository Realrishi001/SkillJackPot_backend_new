import express from 'express'
import { getAdminPointsSummary } from '../controller/summary.controller.js';

const router = express.Router();

router.post("/net-summary", getAdminPointsSummary);

export default router;