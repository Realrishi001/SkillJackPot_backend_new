import express from 'express'
import { getNavbarDetails, getTicketsByDrawTime, getWinningNumbersByLoginId } from '../controller/getWinningNumbers.controller.js';

const router = express.Router();

router.post("/get-winning-numbers", getTicketsByDrawTime);
router.get("/get-winning-slots", getWinningNumbersByLoginId);
router.post("/navbar-details", getNavbarDetails);

export default router;
