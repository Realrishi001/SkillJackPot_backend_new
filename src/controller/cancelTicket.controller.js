import { tickets } from "../models/ticket.model.js";
import { sequelizeCon } from "../init/dbConnection.js";
import { cancelledTickets } from "../models/cancelledTicket.model.js";
import { Op } from "sequelize";

// Helper to get today's date in YYYY-MM-DD format
function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export const getTicketsByDrawTimeForToday = async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ error: "loginId is required" });
    }

    // Calculate today's date range
    const todayDate = getTodayDateString();
    const tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // Get all tickets for loginId for today
    const todaysTickets = await tickets.findAll({
      where: {
        loginId,
        createdAt: {
          [Op.gte]: todayDate + " 00:00:00",
          [Op.lt]: tomorrowDate + " 00:00:00",
        },
      },
      order: [['createdAt', 'ASC']]
    });

    // Map to drawTime
    const resultByDrawTime = {};

    todaysTickets.forEach((ticket) => {
      // ticket.drawTime is an array of times, eg ["03:00 PM", "03:15 PM"]
      (Array.isArray(ticket.drawTime) ? ticket.drawTime : [ticket.drawTime]).forEach((drawTime) => {
        if (!resultByDrawTime[drawTime]) {
          resultByDrawTime[drawTime] = [];
        }
        resultByDrawTime[drawTime].push({
          drawTime,
          drawDate: todayDate,
          ticketNumber: ticket.id,
          totalPoints: ticket.totalPoints,
        });
      });
    });

    // Optional: convert to array for easier frontend usage
    const response = Object.entries(resultByDrawTime).map(([drawTime, tickets]) => ({
      drawTime,
      drawDate: todayDate,
      tickets
    }));

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};


export const deleteTicketByNumber = async (req, res) => {
  const { ticketNo } = req.body; // ticketNo should be the ticket's id

  if (!ticketNo) {
    return res.status(400).json({ error: "ticketNo (id) is required" });
  }

  // Use a transaction for safety
  const t = await sequelizeCon.transaction();
  try {
    // 1. Find the ticket by id
    const ticket = await tickets.findOne({
      where: { id: ticketNo },
      transaction: t,
    });

    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }

    // 2. Move to cancelledTickets (use "totalQuatity" here)
    await cancelledTickets.create({
      gameTime: ticket.gameTime,
      loginId: ticket.loginId,
      ticketNumber: ticket.ticketNumber,
      totalQuatity: ticket.totalQuatity, // <-- spelling kept as you want!
      totalPoints: ticket.totalPoints,
      drawTime: ticket.drawTime,
    }, { transaction: t });

    // 3. Delete from tickets by id
    await tickets.destroy({
      where: { id: ticketNo },
      transaction: t,
    });

    // 4. Commit
    await t.commit();

    res.json({ message: "Ticket cancelled and moved to cancelledTickets" });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};
