import { tickets } from "../models/ticket.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";
import Admin from "../models/admins.model.js";

// Helper to get all two-digit combos as string
const getAllTwoDigit = () => Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, "0"));

// Helper: get a random available number for a prefix
function getRandomUniqueNumber(prefix, usedNumbers) {
  // Build an array of all 100 possible numbers for this prefix
  const possible = getAllTwoDigit().map(last2 => prefix + last2).filter(num => !usedNumbers.has(num));
  if (possible.length === 0) return null; // all used!
  const idx = Math.floor(Math.random() * possible.length);
  return possible[idx];
}

export const getTodaysTicketNumbers = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch all today's ticket numbers
    const allTickets = await tickets.findAll({
      attributes: ["ticketNumber", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    let usedNumbers = new Set();

    // Only process tickets from today
    allTickets.forEach(ticket => {
      const ticketDate = new Date(ticket.createdAt).toISOString().split("T")[0];
      if (ticketDate !== today) return;
      
      // ticketNumber is JSON in your model, but can be array or object or stringified
      let numbersArr = [];
      if (Array.isArray(ticket.ticketNumber)) {
        numbersArr = ticket.ticketNumber;
      } else if (typeof ticket.ticketNumber === "object") {
        // If object, get its keys (or values as needed)
        numbersArr = Object.keys(ticket.ticketNumber);
      } else if (typeof ticket.ticketNumber === "string") {
        try {
          // Try parsing JSON string
          const parsed = JSON.parse(ticket.ticketNumber);
          if (Array.isArray(parsed)) numbersArr = parsed;
          else if (typeof parsed === "object") numbersArr = Object.keys(parsed);
        } catch {
          // If not JSON, maybe it's comma-separated
          numbersArr = ticket.ticketNumber.split(",").map(n => n.trim().split(":")[0]);
        }
      }

      numbersArr.forEach(num => {
        if (typeof num === "string") {
          // Remove any non-digit chars, like hyphens or spaces
          usedNumbers.add(num.replace(/\D/g, ''));
        }
      });
    });

    // Generate random unused number for each prefix in the series
    const generateSeries = (start) => {
      const series = [];
      for (let prefix = start; prefix < start + 10; prefix++) {
        let num;
        let attempts = 0;
        do {
          num = getRandomUniqueNumber(String(prefix), usedNumbers);
          attempts++;
        } while (num && usedNumbers.has(num) && attempts < 200); // avoid infinite loop
        if (num) {
          series.push(num);
          usedNumbers.add(num); // to avoid repeating in this response
        }
      }
      return series;
    };

    const series10 = generateSeries(10); // 10-19
    const series30 = generateSeries(30); // 30-39
    const series50 = generateSeries(50); // 50-59

    res.status(200).json({
      success: true,
      date: today,
      series10,
      series30,
      series50,
      count: {
        series10: series10.length,
        series30: series30.length,
        series50: series50.length,
      }
    });

  } catch (error) {
    console.error("Error generating series numbers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate series numbers",
      error: error.message,
    });
  }
};

export const saveWinningNumbers = async (req, res) => {
  try {
    const { winningNumbers: numbers, totalPoints, DrawTime, drawDate } = req.body;

    if (
      !numbers ||
      !Array.isArray(numbers) ||
      numbers.length === 0 ||
      totalPoints === undefined ||
      !DrawTime ||
      !drawDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing fields. Required: winningNumbers (array), totalPoints, DrawTime, drawDate",
      });
    }

    const loginId = 0; // 🔥 GLOBAL RESULT FIXED FOR ALL ADMINS

    // Check if record already exists for this draw time & date
    const existing = await winningNumbers.findOne({
      where: { loginId, DrawTime, drawDate },
    });

    let record, action;

    if (existing) {
      // Update existing record
      record = await existing.update({
        winningNumbers: numbers,
        totalPoints,
      });
      action = "updated";
    } else {
      // Create new global record
      record = await winningNumbers.create({
        loginId,
        winningNumbers: numbers,
        totalPoints,
        DrawTime,
        drawDate,
      });
      action = "created";
    }

    return res.status(200).json({
      success: true,
      message: `Winning numbers ${action} successfully`,
      data: record,
    });
  } catch (error) {
    console.error("Error saving winning numbers:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving winning numbers",
      error: error.message,
    });
  }
};


export const getSavedWinnerNumbers = async (req, res) => {
  try {
    const { drawDate, DrawTime } = req.body;

    if (!drawDate || !DrawTime) {
      return res.status(400).json({
        success: false,
        message: "drawDate and DrawTime are required"
      });
    }

    // Find any existing record (all admins have same data)
    const existing = await winningNumbers.findOne({
      where: { drawDate, DrawTime },
    });

    if (!existing) {
      return res.status(200).json({
        success: false,
        exists: false,
        message: "No saved results for this draw"
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      message: "Saved results found",
      data: {
        winningNumbers: existing.winningNumbers,
        totalPoints: existing.totalPoints,
        drawDate: existing.drawDate,
        DrawTime: existing.DrawTime
      }
    });

  } catch (error) {
    console.error("Error fetching saved results:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching saved results",
      error: error.message,
    });
  }
};
