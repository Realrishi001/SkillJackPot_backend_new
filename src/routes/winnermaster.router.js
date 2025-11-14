import express from 'express'
import { getSavedWinnerNumbers, getTodaysTicketNumbers, saveWinningNumbers } from '../controller/winnermaster.controller.js';

const router = express.Router();

router.get("/winner-master-manual", getTodaysTicketNumbers);
router.post("/winner-master-manual-save", saveWinningNumbers);
router.post("/get-saved-winner-numbers", getSavedWinnerNumbers);

export default router;