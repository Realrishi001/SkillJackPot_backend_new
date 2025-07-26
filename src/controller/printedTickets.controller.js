import { tickets } from "../models/ticket.model.js";

const savePrintedTickets = async (req, res) => {
    try {
        const { gameTime, ticketNumber, totalQuatity, totalPoints, loginId, drawTime } = req.body;

        if (!Array.isArray(drawTime) || drawTime.length === 0) {
            return res.status(400).json({ message: "drawTime must be a non-empty array." });
            }

        const newTicket = await tickets.create({
            gameTime,
            loginId,
            ticketNumber,
            totalQuatity,
            totalPoints,
            drawTime, // add drawTime here
        });

        return res.status(201).json({
            message: "Ticket saved successfully",
            ticket: newTicket
        });

    } catch (error) {
        console.error("Error saving ticket:", error);
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};
const getPrintedTickets = async (req, res) => {
  try {
    const allTickets = await tickets.findAll({
      attributes: ["id", "gameTime", "totalPoints"], // Removed ticketNumber as id is ticketNo
      order: [["id", "DESC"]]
    });

    const result = allTickets.map(t => {
      // Split the date and time
      let gameDate = "";
      let gameTime = "";
      if (typeof t.gameTime === "string") {
        const [date, ...timeParts] = t.gameTime.split(" ");
        gameDate = date || "";
        gameTime = timeParts.join(" ") || "";
      }
      return {
        ticketNo: t.id,        // Use id as ticketNo
        gameDate,
        gameTime,
        totalPoints: t.totalPoints
      };
    });

    return res.status(200).json({ message: "success", data: result });
  } catch (err) {
    console.error("Error fetching tickets:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export { savePrintedTickets, getPrintedTickets };
