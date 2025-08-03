import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";

// Helper: get prefix list for a series (e.g. "10" => ["10",...,"19"])
function getPrefixList(seriesPrefix) {
  const start = parseInt(seriesPrefix);
  return Array.from({ length: 10 }, (_, i) => String(start + i));
}
// Helper: get random 2 digits as string
function getRandomTwoDigits() {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0');
}
// Helper: get the series from a ticket number
function getSeries(numStr) {
  if (numStr.length < 4) return null;
  return numStr.slice(0, 2);
}
// Helper: For each prefix, pick ticket or fill random
function makeSeriesWinners(prefix, allTicketEntries) {
  const prefixList = getPrefixList(prefix);
  const result = [];
  for (const pfx of prefixList) {
    const candidates = allTicketEntries.filter(entry => entry.number.startsWith(pfx));
    if (candidates.length > 0) {
      result.push(candidates[0]);
    } else {
      result.push({
        number: pfx + getRandomTwoDigits(),
        value: 0
      });
    }
  }
  return result;
}

// Helper for already declared: always return all 10 for each series
function buildFullSeries(seriesPrefix, storedNumbers) {
  const prefixList = getPrefixList(seriesPrefix);
  return prefixList.map(pfx => {
    const found = storedNumbers.find(x => x.number.startsWith(pfx));
    return found || { number: pfx + getRandomTwoDigits(), value: 0 };
  });
}

export const getTicketsByDrawTime = async (req, res) => {
  try {
    const { drawTime, adminId } = req.body;
    if (!drawTime || !adminId) {
      return res.status(400).json({ message: "drawTime and adminId are required" });
    }
    const currentDate = new Date().toISOString().split('T')[0];
    const queryTime = drawTime.trim().toLowerCase();

    // 1. Check if result already exists
    const existingResult = await winningNumbers.findOne({
      where: {
        DrawTime: drawTime,
        drawDate: currentDate,
        loginId: adminId
      }
    });

    if (existingResult) {
      // Parse winning numbers JSON if stored as string
      const storedNumbers =
        typeof existingResult.winningNumbers === "string"
          ? JSON.parse(existingResult.winningNumbers)
          : existingResult.winningNumbers;

      // Always group and return 10 per series
      const series10 = buildFullSeries("10", storedNumbers);
      const series30 = buildFullSeries("30", storedNumbers);
      const series50 = buildFullSeries("50", storedNumbers);

      return res.status(200).json({
        message: `Result already declared for draw time "${drawTime}" on ${currentDate}.`,
        drawTime,
        totalPoints: existingResult.totalPoints,
        commission: null,
        winningPercentage: null,
        updatedTotalPoint: null,
        selectedTickets: storedNumbers,
        sumOfSelected: storedNumbers.reduce((sum, t) => sum + Number(t.value), 0),
        numbersBySeries: {
          "10": series10,
          "30": series30,
          "50": series50
        }
      });
    }

    // --- FETCH ALL TICKETS ---
    const allTickets = await tickets.findAll({
      attributes: ["ticketNumber", "totalPoints", "drawTime", "loginId"]
    });

    // --- FILTER TICKETS FOR DRAW TIME & ADMIN ---
    const filtered = allTickets.filter(ticket => {
      // Match by loginId
      if (String(ticket.loginId) !== String(adminId)) return false;
      // Match by drawTime
      if (!ticket.drawTime) return false;
      let times;
      try {
        times = Array.isArray(ticket.drawTime)
          ? ticket.drawTime
          : JSON.parse(ticket.drawTime);
      } catch (e) {
        return false;
      }
      if (!Array.isArray(times)) return false;
      return times.map(t => String(t).trim().toLowerCase()).includes(queryTime);
    });

    const admin = await Admin.findByPk(adminId, { attributes: ["commission"] });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // --- IF NO TICKETS, RETURN FILLED ZEROES ---
    if (!filtered.length) {
      const fillSeries = (prefix) => getPrefixList(prefix).map(pfx => ({
        number: pfx + getRandomTwoDigits(),
        value: 0
      }));
      const fill10 = fillSeries("10");
      const fill30 = fillSeries("30");
      const fill50 = fillSeries("50");

      await winningNumbers.create({
        loginId: adminId,
        winningNumbers: [...fill10, ...fill30, ...fill50],
        totalPoints: 0,
        DrawTime: drawTime,
        drawDate: currentDate
      });

      return res.status(200).json({
        drawTime,
        totalPoints: 0,
        commission: Number(admin.commission),
        winningPercentage: 0,
        updatedTotalPoint: 0,
        selectedTickets: [...fill10, ...fill30, ...fill50],
        sumOfSelected: 0,
        numbersBySeries: {
          "10": fill10,
          "30": fill30,
          "50": fill50,
        }
      });
    }

    // --- MAP ALL TICKETS INTO {number, value} ENTRIES ---
    const ticketMap = {};
    filtered.forEach(ticket => {
      let ticketStr = ticket.ticketNumber;
      if (typeof ticketStr === "string" && ticketStr.startsWith('"') && ticketStr.endsWith('"')) {
        ticketStr = ticketStr.slice(1, -1);
      }
      const parts = ticketStr.split(",").map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        const [num, val] = part.split(":").map(s => s.trim());
        if (num && val && !isNaN(val)) {
          const numericNum = num.replace(/-/g, "");
          ticketMap[numericNum] = (ticketMap[numericNum] || 0) + Number(val);
        }
      });
    });

    const allTicketEntries = Object.entries(ticketMap).map(([number, value]) => ({
      number,
      value,
    }));

    // --- SELECT EXACTLY 10 NUMBERS FOR EACH SERIES PREFIX ---
    const series10 = makeSeriesWinners("10", allTicketEntries);
    const series30 = makeSeriesWinners("30", allTicketEntries);
    const series50 = makeSeriesWinners("50", allTicketEntries);

    const selectedTickets = [...series10, ...series30, ...series50];
    const numbersBySeries = { "10": series10, "30": series30, "50": series50 };

    // --- CALCULATE TOTALS & WINNING ---
    const totalPoints = filtered.reduce(
      (sum, ticket) => sum + Number(ticket.totalPoints),
      0
    );
    const commissionPercent = Number(admin.commission) || 0;
    const afterCommission = totalPoints - (totalPoints * commissionPercent / 100);

    const latestWinning = await winningPercentage.findOne({
      order: [['createdAt', 'DESC']]
    });
    const winningPercent = latestWinning ? Number(latestWinning.percentage) : 0;
    const updatedTotalPoint = Math.round(afterCommission * (winningPercent / 100));

    // --- SAVE WINNING NUMBERS ---
    await winningNumbers.create({
      loginId: adminId,
      winningNumbers: selectedTickets,
      totalPoints,
      DrawTime: drawTime,
      drawDate: currentDate
    });

    return res.status(200).json({
      drawTime,
      totalPoints,
      commission: commissionPercent,
      winningPercentage: winningPercent,
      updatedTotalPoint,
      selectedTickets,
      sumOfSelected: selectedTickets.reduce((sum, t) => sum + Number(t.value), 0),
      numbersBySeries
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const getWinningNumbersByLoginId = async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ message: "loginId is required" });
    }

    // Find all winning numbers for this loginId
    const records = await winningNumbers.findAll({
      where: { loginId },
      attributes: ["winningNumbers", "DrawTime", "drawDate"],
      order: [["drawDate", "DESC"], ["createdAt", "DESC"]], // latest first
    });

    return res.status(200).json({ count: records.length, results: records });
  } catch (err) {
    console.error("Error fetching winning numbers:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
