import Admin from "../models/admins.model.js";
import { tickets } from "../models/ticket.model.js";

export const getLastTicketAndBalance = async (req, res) => {
  try {
    const { loginId } = req.body;

    // 1. Get last ticket for this loginId
    const lastTicket = await tickets.findOne({
      where: { loginId },
      order: [['createdAt', 'DESC']]
    });

    if (!lastTicket) {
      return res.status(404).json({ message: "No tickets found for this loginId" });
    }

    // 2. Get admin balance
    // (Option A: If loginId is username)
    // const admin = await Admin.findOne({ where: { userName: loginId } });

    // (Option B: If loginId is admin's id (number))
    const admin = await Admin.findOne({ where: { id: loginId } });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found for this loginId" });
    }

    // 3. Response
    return res.json({
      lastTotalPoint: lastTicket.totalPoints,
      lastTicketNumber: lastTicket.id,
      balance: admin.balance
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
