import { tickets } from "../models/ticket.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";
import { claimedTickets } from "../models/claimedTickets.model.js";
import { Op } from "sequelize";
import Admin from "../models/admins.model.js";
import dayjs from "dayjs";

/* ------------------------- HELPER FUNCTIONS ------------------------- */

// Extract date from datetime (e.g. "27-07-2025 11:34:24" → "27-07-2025")
function extractDate(datetimeStr) {
  return typeof datetimeStr === "string" ? datetimeStr.split(" ")[0] : "";
}

// "30-00 : 3" → { ticketNumber: "3000", quantity: 3 }
function extractTicketNumberAndQuantity(str) {
  if (!str) return {};
  const [numPart, qtyPart] = str.split(":").map((s) => s.trim());
  return {
    ticketNumber: numPart ? numPart.replace("-", "") : "",
    quantity: qtyPart ? parseInt(qtyPart, 10) : 0,
  };
}

// "30-00 : 3, 30-11 : 4" → [{ ticketNumber: "3000", quantity: 3 }, ...]
function parseTicketNumberString(ticketNumberStr) {
  if (!ticketNumberStr) return [];
  if (typeof ticketNumberStr !== "string") ticketNumberStr = String(ticketNumberStr);
  return ticketNumberStr.split(",").map(extractTicketNumberAndQuantity);
}

// Normalize draw time (e.g., "08:45 PM" → "8:45 PM")
function normalizeDrawTime(str) {
  if (!str) return "";
  return str.replace(/^0(\d:)/, "$1");
}

export const checkTicketWinningStatus = async (req, res) => {
  try {
    const { ticketId } = req.body;

    // --- Step 1️⃣ — Validate Input ---
    if (!ticketId || ticketId.toString().trim() === "") {
      console.log("⚠️ Missing ticketId in request");
      return res.status(400).json({
        status: "error",
        message: "ticketId is required.",
      });
    }

    console.log("🎯 Checking winning status for Ticket ID:", ticketId);

    // --- Step 2️⃣ — Check if Ticket Already Claimed ---
    const alreadyClaimed = await claimedTickets.findOne({
      where: { TicketId: ticketId },
      attributes: ["id", "TicketId", "drawDate", "claimedDate", "claimedTime"],
    });

    if (alreadyClaimed) {
      console.log("⚠️ Ticket already claimed:", alreadyClaimed.toJSON());
      return res.status(200).json({
        status: "already_claimed",
        message: "This ticket has already been claimed.",
        claimedDetails: alreadyClaimed,
      });
    }

    // --- Step 3️⃣ — Fetch Ticket Details ---
    const ticket = await tickets.findOne({
      where: { id: ticketId },
      attributes: ["gameTime", "loginId", "ticketNumber", "drawTime"],
    });

    if (!ticket) {
      console.log("❌ Ticket not found in database.");
      return res.status(404).json({
        status: "error",
        message: "Ticket not found. Please check the Ticket ID and try again.",
      });
    }

    const drawDate = extractDate(ticket.gameTime);
    const loginId = ticket.loginId;
    console.log("📅 Draw Date:", drawDate);

    // --- Step 4️⃣ — Normalize Draw Times ---
    let drawTimes = ticket.drawTime;
    if (typeof drawTimes === "string") {
      try {
        drawTimes = JSON.parse(drawTimes);
      } catch {
        drawTimes = [drawTimes];
      }
    }
    if (!Array.isArray(drawTimes)) drawTimes = [drawTimes];

    drawTimes = drawTimes
      .filter(Boolean)
      .map((dt) => (typeof dt === "string" ? normalizeDrawTime(dt) : dt))
      .filter(Boolean);

    console.log("🕒 Draw Times:", drawTimes);

    // --- Step 5️⃣ — Parse Ticket Numbers ---
    const ticketNumberRaw = String(ticket.ticketNumber || "");
    const ticketNumbersArr = extractTicketNumbers(ticketNumberRaw);
    console.log("🎟️ Ticket Numbers:", ticketNumbersArr);

    // --- Step 6️⃣ — Setup Variables ---
    const PAYOUT_RATE = 180;
    let results = [];
    let allWinningNumbersSet = new Set();
    let anyDeclaration = false;
    let anyWinning = false;

    // --- Step 7️⃣ — Loop through draw times and check for results ---
    for (let dt of drawTimes) {
      console.log(`🔍 Checking DrawTime: "${dt}" | Date: ${drawDate}`);

      const winningRow = await winningNumbers.findOne({
        where: { DrawTime: dt, drawDate: drawDate },
        attributes: ["winningNumbers"],
      });

      if (!winningRow) {
        console.log("⚠️ No winning numbers declared yet for this draw time.");
        continue;
      }

      anyDeclaration = true;
      let winningNums = winningRow.winningNumbers;
      if (typeof winningNums === "string") {
        try {
          winningNums = JSON.parse(winningNums);
        } catch {
          winningNums = [];
        }
      }

      if (Array.isArray(winningNums)) {
        winningNums.forEach((obj) => allWinningNumbersSet.add(obj.number));
      }

      // --- Build Quick Map for ticket quantities ---
      const qtyMap = new Map();
      ticketNumbersArr.forEach((t) => {
        if (typeof t === "object" && t.ticketNumber) {
          qtyMap.set(t.ticketNumber, t.quantity || 0);
        } else if (typeof t === "string") {
          const cleaned = t.replace(/[^0-9]/g, "");
          qtyMap.set(cleaned, 1);
        }
      });

      // --- Compare for Winning Matches ---
      const matches = ticketNumbersArr
        .map((num) => {
          const ticketNum =
            typeof num === "object" ? num.ticketNumber : num;
          const match = Array.isArray(winningNums)
            ? winningNums.find((obj) => obj.number === ticketNum)
            : null;

          if (match) {
            const quantity = qtyMap.get(ticketNum) || 0;
            const perTicketValue = Number(match.value) || PAYOUT_RATE;
            const totalWinningValue = perTicketValue * quantity;

            return {
              number: ticketNum,
              quantity,
              winningValue: perTicketValue,
              totalWinningValue,
              drawTime: dt,
            };
          }
          return null;
        })
        .filter(Boolean);

      if (matches.length > 0) {
        console.log("🏆 Matches found:", matches);
        anyWinning = true;
        results.push(...matches);
      } else {
        console.log("❌ No matches found for this draw time.");
      }
    }

    // --- Step 8️⃣ — No Declaration Case ---
    if (!anyDeclaration) {
      console.log("🚫 No winning declared yet for any of the draw times.");
      return res.status(200).json({
        status: "no_declaration",
        message: "No winning numbers have been declared yet for this draw time.",
        drawDate,
        drawTimes,
        ticketNumbers: ticketNumbersArr,
      });
    }

    // --- Step 9️⃣ — Winning Case ---
    if (anyWinning) {
      console.log("🎉 WINNING ticket found!");
      return res.status(200).json({
        status: "winner",
        message: "This is a winning ticket!",
        drawDate,
        drawTimes,
        winningTickets: results,
        allWinningNumbers: Array.from(allWinningNumbersSet),
      });
    }

    // --- Step 🔟 — Declared but No Win Case ---
    console.log("😞 Declared but ticket has no matching numbers.");
    return res.status(200).json({
      status: "no_winning",
      message: "The result has been declared, but this ticket has no winning numbers.",
      drawDate,
      drawTimes,
      ticketNumbers: ticketNumbersArr,
      allWinningNumbers: Array.from(allWinningNumbersSet),
    });
  } catch (error) {
    console.error("🔥 Error checking ticket status:", error);
    return res.status(500).json({
      status: "error",
      message:
        error.message ||
        "An unexpected error occurred while checking the ticket status.",
    });
  }
};


function toYYYYMMDD(input) {
  const s = String(input || "");
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { // "DD-MM-YYYY" -> "YYYY-MM-DD"
    const [D, M, Y] = s.split("-");
    return `${Y}-${M}-${D}`;
  }
  return s;
}
function toTimeArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === "string") {
    const s = val.trim();
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
    } catch {
      if (s.length) return [s];
    }
  }
  return [];
}
function csvToObject(csv) {
  const acc = {};
  if (!csv) return acc;
  csv.split(",").forEach((entry) => {
    const [k, v] = entry.split(":").map((s) => s && s.trim());
    if (k && v && !Number.isNaN(Number(v))) acc[k] = Number(v);
  });
  return acc;
}
function parseTicketNumberAny(raw) {
  let obj = {};
  if (!raw) return [];
  if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw;
  } else if (typeof raw === "string") {
    const str = raw.trim();
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed;
      else obj = csvToObject(str);
    } catch {
      obj = csvToObject(str);
    }
  } else {
    try {
      const parsed = JSON.parse(String(raw));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed;
    } catch {
      obj = {};
    }
  }
  const out = [];
  for (const [ticketKey, qtyRaw] of Object.entries(obj)) {
    const quantity = Number(qtyRaw) || 0;
    const ticketNumber = String(ticketKey).replace(/[^0-9]/g, ""); // digits only
    out.push({ ticketNumber, quantity });
  }
  return out;
}

export const claimTicket = async (req, res) => {
  const t = await sequelizeCon.transaction();
  try {
    const { ticketId } = req.body;
    const PAYOUT_RATE = 180;

    console.log("\n🎯 CLAIM PROCESS STARTED");
    console.log("➡️ Received Ticket ID:", ticketId);

    if (!ticketId) {
      return res.status(400).json({
        status: "error",
        message: "ticketId is required",
      });
    }

    // Step 1️⃣: Check if already claimed
    const existingClaim = await claimedTickets.findOne({
      where: { TicketId: ticketId },
      attributes: ["id", "TicketId"],
      transaction: t,
    });

    if (existingClaim) {
      await t.rollback();
      console.warn(`⚠️ Ticket ${ticketId} already claimed.`);
      return res.status(409).json({
        status: "already_claimed",
        message: `Ticket ${ticketId} has already been claimed.`,
      });
    }

    // Step 2️⃣: Fetch the ticket
    const ticket = await tickets.findOne({
      where: { id: ticketId },
      attributes: ["id", "loginId", "ticketNumber", "drawTime", "gameTime"],
      transaction: t,
    });

    if (!ticket) {
      await t.rollback();
      console.warn(`❌ No ticket found for ID: ${ticketId}`);
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }

    console.log("\n🎟️ Ticket Found:", JSON.stringify(ticket.toJSON(), null, 2));
    const { loginId, ticketNumber, drawTime, gameTime } = ticket;

    // Step 3️⃣: Format Draw Date
    let drawDate = "";
    if (typeof gameTime === "string") {
      const datePart = gameTime.split(" ")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) drawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      drawDate = new Date(gameTime).toISOString().split("T")[0];
    }

    // Step 4️⃣: Parse Draw Times
    let parsedDrawTimes = [];
    try {
      parsedDrawTimes = Array.isArray(drawTime)
        ? drawTime
        : JSON.parse(drawTime);
    } catch (err) {
      parsedDrawTimes = [drawTime];
    }

    // Step 5️⃣: Fetch Winning Numbers
    const allWinningRows = await winningNumbers.findAll({
      where: { drawDate },
      attributes: ["winningNumbers", "DrawTime", "drawDate"],
      transaction: t,
    });

    if (!allWinningRows.length) {
      await t.rollback();
      console.warn("⚠️ No winning numbers found for this date.");
      return res.status(200).json({
        status: "no_winning_data",
        message: "No winning numbers found for this draw date.",
      });
    }

    // Step 6️⃣: Filter Relevant Draw Times
    const matchedRows = [];
    for (const row of allWinningRows) {
      let winTimes = [];
      try {
        winTimes = Array.isArray(row.DrawTime)
          ? row.DrawTime
          : JSON.parse(row.DrawTime);
      } catch {
        winTimes = [];
      }
      if (parsedDrawTimes.some((t) => winTimes.includes(t))) {
        matchedRows.push(row);
      }
    }

    if (!matchedRows.length) {
      await t.rollback();
      console.warn("❌ No matching draw time found between ticket and winners.");
      return res.status(200).json({
        status: "no_match",
        message: "No matching draw time found.",
      });
    }

    // Step 7️⃣: Parse Ticket Numbers
    let parsedTickets = [];
    try {
      const cleaned = ticketNumber.replace(/"/g, "");
      const parts = cleaned.split(",").map((x) => x.trim());
      parsedTickets = parts.map((p) => {
        const [num, qty] = p.split(":").map((x) => x.trim());
        return {
          number: num.replace("-", ""),
          qty: parseInt(qty) || 0,
        };
      });
    } catch (err) {
      console.error("⚠️ Error parsing ticket numbers:", err);
    }

    // Step 8️⃣: Combine Winning Numbers
    const winningNumbersSet = new Set();
    for (const row of matchedRows) {
      let winners = [];
      try {
        winners = Array.isArray(row.winningNumbers)
          ? row.winningNumbers
          : JSON.parse(row.winningNumbers);
      } catch {
        winners = [];
      }
      for (const w of winners) {
        if (w.number) winningNumbersSet.add(w.number);
      }
    }

    // Step 9️⃣: Compare & Find Matches
    const matches = [];
    for (const tkt of parsedTickets) {
      if (winningNumbersSet.has(tkt.number)) {
        const payout = tkt.qty * PAYOUT_RATE;
        matches.push({
          number: tkt.number,
          quantity: tkt.qty,
          payout,
        });
      }
    }

    if (!matches.length) {
      await t.rollback();
      console.warn("😞 No winning numbers in this ticket.");
      return res.status(200).json({
        status: "no_win",
        message: "Ticket has no winning numbers.",
      });
    }

    const totalWinningAmount = matches.reduce((sum, m) => sum + m.payout, 0);

    // Step 🔟: Save Claim
    const now = new Date();
    const claimedDate = now.toISOString().split("T")[0];
    const claimedTime = now.toTimeString().split(" ")[0];

    await claimedTickets.create(
      {
        TicketId: ticketId,
        loginId,
        ticketNumbers: matches,
        drawTime: parsedDrawTimes.join(", "),
        drawDate,
        claimedDate,
        claimedTime,
      },
      { transaction: t }
    );

    console.log(`💾 Ticket ${ticketId} saved to claimedTickets.`);

    // Step 1️⃣1️⃣: Update Admin Balance (same as cancelTicket logic)
    const admin = await Admin.findOne({
      where: { id: loginId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (admin) {
      const prevBalance = Number(admin.balance) || 0;
      const newBalance = prevBalance + totalWinningAmount;
      admin.balance = newBalance;
      await admin.save({ transaction: t });
      console.log(
        `💰 Admin ${loginId} balance updated: ${prevBalance} + ${totalWinningAmount} = ${newBalance}`
      );
    } else {
      console.warn(`⚠️ Admin not found for loginId ${loginId}`);
    }

    await t.commit();

    // ✅ Final Response
    return res.status(201).json({
      status: "ticket_claimed",
      message: `Ticket successfully claimed! ₹${totalWinningAmount} added to admin balance.`,
      ticketId,
      drawDate,
      drawTime: parsedDrawTimes,
      matches,
      totalWinningAmount,
    });
  } catch (error) {
    await t.rollback();
    console.error("🔥 Error in claimTicket:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while claiming ticket.",
      error: error.message,
    });
  }
};


const getTotalQuantity = (ticketNumbers) => {
  if (!Array.isArray(ticketNumbers)) return 0;
  return ticketNumbers.reduce((sum, item) => sum + (item?.quantity || 0), 0);
};

const extractTicketNumbers = (ticketNumbers) => {
  if (!Array.isArray(ticketNumbers)) return [];
  return ticketNumbers.map((item) => item?.number);
};

export const getClaimedTickets = async (req, res) => {
  try {
    let { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      const today = dayjs().format("YYYY-MM-DD");
      fromDate = today;
      toDate = today;
    }

    const claimed = await claimedTickets.findAll({
      where: {
        claimedDate: {
          [Op.gte]: fromDate,
          [Op.lte]: toDate,
        },
      },
      order: [["drawDate", "DESC"], ["drawTime", "DESC"]],
    });

    if (!claimed.length) {
      return res.status(200).json({
        message: `No claimed tickets found between ${fromDate} and ${toDate}`,
        totalRecords: 0,
        distributedData: {},
      });
    }

    const uniqueLoginIds = [...new Set(claimed.map((row) => row.loginId))];
    const admins = await Admin.findAll({
      where: { id: uniqueLoginIds },
      attributes: ["id", "shopName", "contactPersonName", "userName"],
    });

    const adminMap = {};
    admins.forEach((a) => {
      adminMap[a.id] = {
        shopName: a.shopName,
        contactPersonName: a.contactPersonName,
        userName: a.userName,
      };
    });

    const formattedData = claimed.map((row) => {
      let ticketNumbersArr = row.ticketNumbers;
      if (typeof ticketNumbersArr === "string") {
        try {
          ticketNumbersArr = JSON.parse(ticketNumbersArr);
        } catch {
          ticketNumbersArr = [];
        }
      }

      const admin = adminMap[row.loginId] || {
        shopName: "Unknown",
        contactPersonName: "N/A",
        userName: "N/A",
      };

      return {
        ticketId: row.TicketId,
        adminId: row.loginId,
        shopName: admin.shopName,
        contactPersonName: admin.contactPersonName,
        userName: admin.userName,
        drawDate: row.drawDate,
        drawTime: row.drawTime,
        claimedDate: row.claimedDate,
        claimedTime: row.claimedTime,
        totalQuantity: getTotalQuantity(ticketNumbersArr),
        ticketNumbers: extractTicketNumbers(ticketNumbersArr),
      };
    });

    return res.status(200).json({
      message: `Claimed tickets between ${fromDate} and ${toDate}`,
      totalRecords: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error in getClaimedTickets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
