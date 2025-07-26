import express from 'express'
import { getTicketSummary } from '../controller/drawloadpoint.controller.js';

const router = express.Router();

router.get("/draw-details", getTicketSummary);

export default router;