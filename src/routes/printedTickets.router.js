import { getPrintedTickets, savePrintedTickets, subtractAdminBalance } from "../controller/printedTickets.controller.js";
import express from "express"

const router = express.Router();

router.post("/saveTicket", savePrintedTickets);
router.post("/reprint-tickets", getPrintedTickets);
router.post("/subtract-balance", subtractAdminBalance);

export default router;
