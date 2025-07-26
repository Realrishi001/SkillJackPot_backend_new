import { getPrintedTickets, savePrintedTickets } from "../controller/printedTickets.controller.js";
import express from "express"

const router = express.Router();

router.post("/saveTicket", savePrintedTickets);
router.get("/reprint-tickets", getPrintedTickets);

export default router;
