import { Op } from "sequelize";
import { tickets } from "../models/ticket.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";

const POINTS_PER_QUANTITY = 180;

/* ------------------ FORMAT DRAW TIME ------------------ */
const formatDrawTime = (time) => {
  if (!time) return "";
  let clean = String(time).trim().toUpperCase();
  clean = clean.replace(/(AM|PM)/, " $1").trim();

  const match = clean.match(/^(\d{1,2})[:.]?(\d{0,2})?\s*(AM|PM)$/);
  if (!match) return clean;

  let [, h, m, p] = match;
  h = String(h).padStart(2, "0");
  m = m ? String(m).padStart(2, "0") : "00";

  return `${h}:${m} ${p}`;
};

/* ------------------ PARSE TICKET NUMBER ------------------ */
// Accepts your format: "10-01:4,30-02:8"
const parseTicketNumberToMap = (ticketStr) => {
  const map = {};

  if (!ticketStr) return map;

  try {
    const pairs = String(ticketStr)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    for (let p of pairs) {
      const [num, qty] = p.split(":").map((s) => s.trim());
      const number = num.replace(/-/g, "");
      const quantity = Number(qty || 0);
      map[number] = (map[number] || 0) + quantity;
    }
  } catch (err) {
    console.log("Parse error:", err);
  }

  return map;
};

/* ------------------ RANDOM SERIES FILLER ------------------ */
const randomSeriesFill = (prefix) => {
  const used = new Set();
  const result = [];

  while (result.length < 10) {
    const randomTwo = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");

    const num = `${prefix}${randomTwo}`;

    if (!used.has(num)) {
      used.add(num);
      result.push({
        number: num,
        quantity: 0,
        value: 0,
      });
    }
  }

  return result;
};

export const autoGenerateWinningNumbers = async (drawTime) => {
  try {
    const normalized = formatDrawTime(drawTime);
    const drawDate = new Date().toISOString().split("T")[0];

    console.log(`⏳ Auto Draw Triggered → ${normalized}`);

    /* ------------------ CHECK IF ALREADY EXISTS ------------------ */
    const exists = await winningNumbers.findOne({
      where: { DrawTime: normalized, drawDate },
    });

    if (exists) {
      console.log(`⛔ Result already exists for ${normalized}`);
      return false;
    }

    /* ------------------ FETCH ALL TODAY'S TICKETS ------------------ */
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const all = await tickets.findAll({
      where: { createdAt: { [Op.between]: [start, end] } },
      attributes: ["ticketNumber", "totalPoints", "drawTime"],
    });

    /* ------------------ FILTER BY DRAW TIME ------------------ */
    const filtered = all.filter((t) => {
      try {
        const times = Array.isArray(t.drawTime)
          ? t.drawTime
          : JSON.parse(t.drawTime);

        return times.map((x) => formatDrawTime(x)).includes(normalized);
      } catch {
        return false;
      }
    });

    /* ------------------ IF NO TICKETS → RETURN RANDOM SET ------------------ */
    if (!filtered.length) {
      console.log("⚠ No tickets found → Saving RANDOM full series");

      const series10 = randomSeriesFill("10");
      const series30 = randomSeriesFill("30");
      const series50 = randomSeriesFill("50");

      await winningNumbers.create({
        loginId: 0,
        winningNumbers: [...series10, ...series30, ...series50],
        totalPoints: 0,
        DrawTime: normalized,
        drawDate,
      });

      return true;
    }

    /* ------------------ CALCULATE TOTAL POINTS ------------------ */
    const totalPoints = filtered.reduce(
      (sum, t) => sum + Number(t.totalPoints || 0),
      0
    );

    /* ------------------ WINNING PERCENTAGE LOGIC ------------------ */
    const latest = await winningPercentage.findOne({
      order: [["createdAt", "DESC"]],
    });

    const winningPercent = latest ? Number(latest.percentage || 0) : 0;

    const winningPool = Math.floor((totalPoints * winningPercent) / 100);
    let qtyCapacity = Math.floor(winningPool / POINTS_PER_QUANTITY);

    /* ------------------ BUILD NUMBER TOTALS ------------------ */
    const totals = {};

    for (let t of filtered) {
      const parsed = parseTicketNumberToMap(t.ticketNumber);

      for (let [num, qty] of Object.entries(parsed)) {
        totals[num] = (totals[num] || 0) + qty;
      }
    }

    /* ------------------ SORT BY QUANTITY DESC ------------------ */
    const sorted = Object.entries(totals)
      .map(([num, qty]) => ({ number: num, qty }))
      .sort((a, b) => b.qty - a.qty);

    let winners = [];

    for (let item of sorted) {
      if (item.qty <= qtyCapacity) {
        winners.push({
          number: item.number,
          quantity: item.qty,
          value: item.qty * POINTS_PER_QUANTITY,
        });
        qtyCapacity -= item.qty;
      }
      if (qtyCapacity <= 0) break;
    }

    /* ------------------ FALLBACK SMALL QUANTITY FIRST ------------------ */
    if (qtyCapacity > 0) {
      const fallback = sorted.slice().sort((a, b) => a.qty - b.qty);

      for (let item of fallback) {
        if (!winners.some((w) => w.number === item.number)) {
          if (item.qty <= qtyCapacity) {
            winners.push({
              number: item.number,
              quantity: item.qty,
              value: item.qty * POINTS_PER_QUANTITY,
            });
            qtyCapacity -= item.qty;
          }
        }
        if (qtyCapacity <= 0) break;
      }
    }

    /* ------------------ LAST RESORT ------------------ */
    if (winners.length === 0 && sorted.length > 0) {
      const smallest = sorted[sorted.length - 1];
      winners.push({
        number: smallest.number,
        quantity: smallest.qty,
        value: smallest.qty * POINTS_PER_QUANTITY,
      });
    }

    /* =====================================================
         ADD REMAINING RANDOM NON-WINNER NUMBERS
       ===================================================== */

    const final10 = [];
    const final30 = [];
    const final50 = [];

    const usedWinners = new Set(winners.map((w) => w.number));

    // Helper random generator
    const randomFill = (prefix, used, existingArr) => {
      const result = [...existingArr];

      while (result.length < 10) {
        const r = Math.floor(Math.random() * 100)
          .toString()
          .padStart(2, "0");

        const num = `${prefix}${r}`;

        if (!used.has(num)) {
          used.add(num);
          result.push({
            number: num,
            quantity: 0,
            value: 0,
          });
        }
      }

      return result;
    };

    // Fill winners into correct series groups first
    winners.forEach((w) => {
      if (w.number.startsWith("10")) final10.push(w);
      else if (w.number.startsWith("30")) final30.push(w);
      else if (w.number.startsWith("50")) final50.push(w);
    });

    // Now random-fill the remaining
    const used = new Set(usedWinners);

    const full10 = randomFill("10", used, final10);
    const full30 = randomFill("30", used, final30);
    const full50 = randomFill("50", used, final50);

    const finalResult = [...full10, ...full30, ...full50];

    /* ------------------ SAVE ------------------ */
    await winningNumbers.create({
      loginId: 0,
      winningNumbers: finalResult,
      totalPoints,
      DrawTime: normalized,
      drawDate,
    });

    console.log(`🎉 FULL 30-NUMBER RESULT SAVED FOR ${normalized}`);

    return true;

  } catch (err) {
    console.error("❌ Auto Draw Error:", err);
    return false;
  }
};
