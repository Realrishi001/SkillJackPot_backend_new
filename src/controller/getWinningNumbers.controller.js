import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";

/* ---------------------- Helper Functions ---------------------- */

// 🔹 Get the prefix (first 2 digits)
function getSeries(numStr) {
  if (numStr.length < 4) return null;
  return numStr.slice(0, 2);
}

// 🔹 Random 2-digit number between 10–99
function getRandomTwoDigits() {
  return Math.floor(Math.random() * 90 + 10);
}

// 🔹 Get all base numbers for a given prefix (10, 30, 50)
function getPrefixList(prefix) {
  // Generates 10 base entries for each series (10xx, 30xx, 50xx)
  return Array.from({ length: 10 }, (_, i) => `${prefix}${i}`);
}

/* ---------------------- Build a Full 10-Entry Series ---------------------- */
function buildFullSeries(prefix, allNumbers) {
  const matches = allNumbers.filter((n) => n.number.startsWith(prefix));
  const used = new Set(matches.map((m) => m.number));
  const list = [...matches];

  while (list.length < 10) {
    const rand = `${prefix}${String(getRandomTwoDigits()).padStart(2, "0")}`;
    if (!used.has(rand)) {
      used.add(rand);
      list.push({ number: rand, value: 0 });
    }
  }

  return list.map((num) => ({
    number: num.number,
    value: Number(num.value) || 0,
  }));
}

/* ---------------------- Choose Top 10 Winners for a Series ---------------------- */
function makeSeriesWinners(prefix, allTickets) {
  const list = allTickets.filter((t) => t.number.startsWith(prefix));
  const sorted = list.sort((a, b) => b.value - a.value);
  const winners = [];
  const used = new Set();

  for (let i = 0; i < 10; i++) {
    if (sorted[i] && !used.has(sorted[i].number)) {
      winners.push(sorted[i]);
      used.add(sorted[i].number);
    } else {
      let randNum;
      do {
        randNum = `${prefix}${String(getRandomTwoDigits()).padStart(2, "0")}`;
      } while (used.has(randNum));
      used.add(randNum);
      winners.push({ number: randNum, value: 0 });
    }
  }

  return winners;
}


// Format draw time
const formatDrawTime = (time) => {
  if (!time) return "";
  let clean = String(time).trim().toUpperCase();
  clean = clean.replace(/(AM|PM)/, " $1").trim();

  const match = clean.match(/^(\d{1,2})[:.]?(\d{0,2})?\s*(AM|PM)$/);
  if (!match) return clean;

  let [, h, m, period] = match;
  h = String(h).padStart(2, "0");
  m = m ? String(m).padStart(2, "0") : "00";
  return `${h}:${m} ${period}`;
};

export const getTicketsByDrawTime = async (req, res) => {
  try {
    const { drawTime } = req.body;

    if (!drawTime) {
      return res.status(400).json({
        message: "drawTime is required",
      });
    }

    const normalizedDrawTime = formatDrawTime(drawTime);
    const currentDate = new Date().toISOString().split("T")[0];

    // 🔍 Fetch GLOBAL winning result (no adminId required)
    const existingResult = await winningNumbers.findOne({
      where: {
        DrawTime: normalizedDrawTime,
        drawDate: currentDate,
      },
    });

    if (!existingResult) {
      return res.status(404).json({
        message: `No winning numbers found for ${normalizedDrawTime} on ${currentDate}.`,
      });
    }

    const storedNumbers =
      typeof existingResult.winningNumbers === "string"
        ? JSON.parse(existingResult.winningNumbers)
        : existingResult.winningNumbers;

    return res.status(200).json({
      message: "Winning numbers retrieved successfully.",
      drawTime: normalizedDrawTime,
      drawDate: currentDate,
      totalPoints: existingResult.totalPoints,
      selectedTickets: storedNumbers,
      sumOfSelected: storedNumbers.reduce(
        (sum, t) => sum + Number(t.value || 0),
        0
      ),
    });
  } catch (err) {
    console.error("🔥 Error fetching winning numbers:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};



/* ------------------------------------------------------------------
   📊 Controller: Get Navbar Details (balance, last ticket)
------------------------------------------------------------------ */
export const getNavbarDetails = async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ message: "loginId required" });
    }

    const admin = await Admin.findByPk(loginId, {
      attributes: ["balance", "commission"],
    });

    const lastTicket = await tickets.findOne({
      where: { loginId },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "totalPoints"],
    });

    return res.status(200).json({
      lastTicketNumber: lastTicket?.id || "-",
      lastTotalPoint: lastTicket?.totalPoints || 0,
      balance: admin?.balance || 0,
      commission: admin?.commission || 0,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};


export const getWinningNumbersByLoginId = async (req, res) => {
  try {
    // Get today's date (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];

    console.log(`📅 Fetching winning numbers for: ${today}`);

    // Fetch all winning numbers for today's date (no loginId filter)
    const records = await winningNumbers.findAll({
      where: {
        drawDate: today,
      },
      attributes: ["winningNumbers", "DrawTime", "drawDate", "loginId"],
      order: [
        ["drawDate", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    if (!records.length) {
      console.warn("⚠️ No winning numbers found for today.");
      return res.status(200).json({
        message: "No winning numbers found for today.",
        count: 0,
        results: [],
      });
    }

    console.log(`✅ Found ${records.length} winning records for today.`);

    return res.status(200).json({
      message: "Today's winning numbers fetched successfully.",
      count: records.length,
      results: records,
    });
  } catch (err) {
    console.error("🔥 Error fetching today's winning numbers:", err);
    return res.status(500).json({
      message: "Server error while fetching today's winning numbers.",
      error: err.message,
    });
  }
};
