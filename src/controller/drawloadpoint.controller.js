import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";

export const getTicketSummary = async (req, res) => {
  try {
    // Fetch commission percentage (assuming one admin or use logic for multiple admins)
    const admin = await Admin.findOne({ attributes: ["commission"] });
    const commissionPercent = admin ? parseFloat(admin.commission) : 0;

    // Fetch tickets with loginId
    const allTickets = await tickets.findAll({
      attributes: [
        "id",
        "loginId",
        "ticketNumber",
        "totalQuatity",
        "totalPoints",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = allTickets.map((ticket) => {
      let total10SeriesCount = 0;
      let total30SeriesCount = 0;
      let total50SeriesCount = 0;

      let total10SeriesPoints = 0;
      let total30SeriesPoints = 0;
      let total50SeriesPoints = 0;

      const ticketData =
        typeof ticket.ticketNumber === "string"
          ? ticket.ticketNumber
          : JSON.stringify(ticket.ticketNumber);

      const pairs = ticketData.split(",");
      pairs.forEach((pair) => {
        const [key, value] = pair.split(":").map((v) => v.trim());
        const baseNumber = parseInt(key.split("-")[0], 10);
        const points = parseFloat(value || 0);

        if (baseNumber >= 10 && baseNumber <= 19) {
          total10SeriesCount += 1;
          total10SeriesPoints += points;
        } else if (baseNumber >= 30 && baseNumber <= 39) {
          total30SeriesCount += 1;
          total30SeriesPoints += points;
        } else if (baseNumber >= 50 && baseNumber <= 59) {
          total50SeriesCount += 1;
          total50SeriesPoints += points;
        }
      });

      const totalPoints = parseFloat(ticket.totalPoints || 0);

      // Shop and Net Amount
      const shopAmount = (totalPoints * commissionPercent) / 100;
      const netAmount = totalPoints - shopAmount;

      // Series-level shop and net
      const series10ShopAmount = (total10SeriesPoints * commissionPercent) / 100;
      const series10NetAmount = total10SeriesPoints - series10ShopAmount;

      const series30ShopAmount = (total30SeriesPoints * commissionPercent) / 100;
      const series30NetAmount = total30SeriesPoints - series30ShopAmount;

      const series50ShopAmount = (total50SeriesPoints * commissionPercent) / 100;
      const series50NetAmount = total50SeriesPoints - series50ShopAmount;

      return {
        id: ticket.id,
        loginId: ticket.loginId,
        totalQuantity: ticket.totalQuatity,
        total10SeriesCount,
        total10SeriesPoints: parseFloat(total10SeriesPoints.toFixed(2)),
        series10ShopAmount: parseFloat(series10ShopAmount.toFixed(2)),
        series10NetAmount: parseFloat(series10NetAmount.toFixed(2)),
        total30SeriesCount,
        total30SeriesPoints: parseFloat(total30SeriesPoints.toFixed(2)),
        series30ShopAmount: parseFloat(series30ShopAmount.toFixed(2)),
        series30NetAmount: parseFloat(series30NetAmount.toFixed(2)),
        total50SeriesCount,
        total50SeriesPoints: parseFloat(total50SeriesPoints.toFixed(2)),
        series50ShopAmount: parseFloat(series50ShopAmount.toFixed(2)),
        series50NetAmount: parseFloat(series50NetAmount.toFixed(2)),
        totalPoints: parseFloat(totalPoints.toFixed(2)),
        shopAmount: parseFloat(shopAmount.toFixed(2)),
        netAmount: parseFloat(netAmount.toFixed(2)),
        createdAt: ticket.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      commissionPercent: parseFloat(commissionPercent.toFixed(2)),
      tickets: result,
    }); 
  } catch (error) {
    console.error("Error fetching ticket summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ticket summary",
      error: error.message,
    });
  }
};
