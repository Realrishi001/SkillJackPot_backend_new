import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";


// 🔹 Extract the series prefix (first 2 digits) from a ticket number
function getSeries(numStr) {
  if (numStr.length < 4) return null;
  return numStr.slice(0, 2);
}

function getRandomTwoDigits() {
  return Math.floor(Math.random() * 90 + 10); // → returns between 10–99
}

/* ---------------------- Helper: Get All Prefix Numbers ---------------------- */
function getPrefixList(prefix) {
  // Each series (10, 30, 50) has numbers 0–9 suffix
  return Array.from({ length: 10 }, (_, i) => `${prefix}${i}`);
}

/* ---------------------- Helper: Build a Full 10-Entry Series ---------------------- */
function buildFullSeries(prefix, allNumbers) {
  // Get all numbers that start with prefix (e.g., "10", "30", "50")
  const matches = allNumbers.filter((n) => n.number.startsWith(prefix));
  const list = [];

  // If fewer than 10 found, fill missing with zeros
  for (let i = 0; i < 10; i++) {
    const num = matches[i] || { number: `${prefix}${i}`, value: 0 };
    list.push({ number: num.number, value: Number(num.value) || 0 });
  }
  return list;
}

/* ---------------------- Helper: Choose Winners for a Series ---------------------- */
function makeSeriesWinners(prefix, allTickets) {
  const list = allTickets.filter((t) => t.number.startsWith(prefix));

  // Sort descending by value → pick top 10 highest
  const sorted = list.sort((a, b) => b.value - a.value);

  // Fill missing with zero-value random numbers
  const winners = [];
  for (let i = 0; i < 10; i++) {
    if (sorted[i]) winners.push(sorted[i]);
    else
      winners.push({
        number: `${prefix}${getRandomTwoDigits()}`,
        value: 0,
      });
  }

  return winners;
}

/* ---------------------- Controller: getTicketsByDrawTime ---------------------- */
export const getTicketsByDrawTime = async (req, res) => {
  try {
    const { drawTime, adminId } = req.body;
    if (!drawTime || !adminId) {
      return res
        .status(400)
        .json({ message: "drawTime and adminId are required" });
    }

    const currentDate = new Date().toISOString().split("T")[0];
    const queryTime = drawTime.trim().toLowerCase();

    // 1️⃣ Check if result already exists
    const existingResult = await winningNumbers.findOne({
      where: {
        DrawTime: drawTime,
        drawDate: currentDate,
        loginId: adminId,
      },
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
        sumOfSelected: storedNumbers.reduce(
          (sum, t) => sum + Number(t.value),
          0
        ),
        numbersBySeries: {
          "10": series10,
          "30": series30,
          "50": series50,
        },
      });
    }

    // 2️⃣ Fetch all tickets
    const allTickets = await tickets.findAll({
      attributes: ["ticketNumber", "totalPoints", "drawTime", "loginId"],
    });

    // 3️⃣ Filter by admin & drawTime
    const filtered = allTickets.filter((ticket) => {
      if (String(ticket.loginId) !== String(adminId)) return false;
      if (!ticket.drawTime) return false;

      let times;
      try {
        times = Array.isArray(ticket.drawTime)
          ? ticket.drawTime
          : JSON.parse(ticket.drawTime);
      } catch (e) {
        return false;
      }

      return (
        Array.isArray(times) &&
        times.map((t) => String(t).trim().toLowerCase()).includes(queryTime)
      );
    });

    const admin = await Admin.findByPk(adminId, {
      attributes: ["commission"],
    });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // 4️⃣ No tickets → fill zero series
    if (!filtered.length) {
      const fillSeries = (prefix) =>
        getPrefixList(prefix).map((pfx) => ({
          number: pfx + getRandomTwoDigits(),
          value: 0,
        }));

      const fill10 = fillSeries("10");
      const fill30 = fillSeries("30");
      const fill50 = fillSeries("50");

      await winningNumbers.create({
        loginId: adminId,
        winningNumbers: [...fill10, ...fill30, ...fill50],
        totalPoints: 0,
        DrawTime: drawTime,
        drawDate: currentDate,
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
        },
      });
    }

    // 5️⃣ Combine ticket data into {number, value}
    const ticketMap = {};
    filtered.forEach((ticket) => {
      let ticketStr = ticket.ticketNumber;
      if (
        typeof ticketStr === "string" &&
        ticketStr.startsWith('"') &&
        ticketStr.endsWith('"')
      ) {
        ticketStr = ticketStr.slice(1, -1);
      }

      const parts = ticketStr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      parts.forEach((part) => {
        const [num, val] = part.split(":").map((s) => s.trim());
        if (num && val && !isNaN(val)) {
          const numericNum = num.replace(/-/g, "");
          ticketMap[numericNum] =
            (ticketMap[numericNum] || 0) + Number(val);
        }
      });
    });

    const allTicketEntries = Object.entries(ticketMap).map(
      ([number, value]) => ({
        number,
        value,
      })
    );

    // 6️⃣ Pick winners for each series
    const series10 = makeSeriesWinners("10", allTicketEntries);
    const series30 = makeSeriesWinners("30", allTicketEntries);
    const series50 = makeSeriesWinners("50", allTicketEntries);

    const selectedTickets = [...series10, ...series30, ...series50];
    const numbersBySeries = { "10": series10, "30": series30, "50": series50 };

    // 7️⃣ Calculate totals
    const totalPoints = filtered.reduce(
      (sum, ticket) => sum + Number(ticket.totalPoints),
      0
    );
    const commissionPercent = Number(admin.commission) || 0;
    const afterCommission =
      totalPoints - totalPoints * (commissionPercent / 100);

    const latestWinning = await winningPercentage.findOne({
      order: [["createdAt", "DESC"]],
    });
    const winningPercent = latestWinning
      ? Number(latestWinning.percentage)
      : 0;

    const updatedTotalPoint = Math.round(
      afterCommission * (winningPercent / 100)
    );

    // 8️⃣ Save results
    await winningNumbers.create({
      loginId: adminId,
      winningNumbers: selectedTickets,
      totalPoints,
      DrawTime: drawTime,
      drawDate: currentDate,
    });

    return res.status(200).json({
      drawTime,
      totalPoints,
      commission: commissionPercent,
      winningPercentage: winningPercent,
      updatedTotalPoint,
      selectedTickets,
      sumOfSelected: selectedTickets.reduce(
        (sum, t) => sum + Number(t.value),
        0
      ),
      numbersBySeries,
    });
  } catch (err) {
    console.error("🔥 Error in getTicketsByDrawTime:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
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
