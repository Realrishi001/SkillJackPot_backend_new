import express from 'express'
import { getLastTicketAndBalance } from '../controller/navbar.controller.js';

const router = express.Router();

router.post("/navbar-details", getLastTicketAndBalance);

export default router;