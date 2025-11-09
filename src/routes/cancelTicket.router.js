import express from 'express'
import { getTicketsByDrawTimeForToday, deleteTicketByNumber, getCancelledTicketsForToday} from '../controller/cancelTicket.controller.js';

const router = express.Router();

router.post("/show-tickets", getTicketsByDrawTimeForToday)
router.post("/cancel-ticket", deleteTicketByNumber);
router.post("/cancelled-tickets", getCancelledTicketsForToday)


export default router;