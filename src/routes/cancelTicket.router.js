import express from 'express'
import { getTicketsByDrawTimeForToday, deleteTicketByNumber} from '../controller/cancelTicket.controller.js';

const router = express.Router();

router.post("/show-tickets", getTicketsByDrawTimeForToday)
router.post("/cancel-ticket", deleteTicketByNumber);

export default router;