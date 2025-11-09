// controllers/tickets.controller.js
import { Op } from "sequelize";
import { sequelizeCon } from "../init/dbConnection.js";
import Admin from "../models/admins.model.js";
import { tickets } from "../models/ticket.model.js";

export const savePrintedTickets = async (req, res) => {
  const t = await sequelizeCon.transaction();
  try {
    let {
      gameTime,
      ticketNumber,
      totalQuatity,
      totalPoints,
      loginId,
      drawTime,
    } = req.body;

    // ✅ Log incoming request for debugging
    console.log("🧾 Incoming Ticket Data:", req.body);

    // --- Validation ---
    if (!Array.isArray(drawTime) || drawTime.length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "drawTime must be a non-empty array." });
    }

    // ✅ Check the real drawTime structure
    console.log("🎯 Raw drawTime received:", JSON.stringify(drawTime, null, 2));

    // ✅ Detect nested arrays like [["11:45 AM"], ["12:00 PM"]]
    let normalizedDrawTimes = [];

    drawTime.forEach((item) => {
      if (Array.isArray(item)) {
        // Flatten inner array elements
        normalizedDrawTimes.push(...item);
      } else {
        normalizedDrawTimes.push(item);
      }
    });

    // ✅ Log normalized draw times
    console.log("🧩 Normalized Draw Times (Flattened):", normalizedDrawTimes);

    // ✅ Assign back normalized array before saving
    drawTime = normalizedDrawTimes;

    const basePoints = Number(totalPoints);
    if (!Number.isFinite(basePoints) || basePoints < 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "totalPoints must be a non-negative number." });
    }

    if (!loginId) {
      await t.rollback();
      return res.status(400).json({ message: "loginId is required." });
    }

    // --- Lock admin record for safe balance update ---
    const admin = await Admin.findOne({
      where: { id: loginId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({ message: "Admin not found." });
    }

    const currentBalance = Number(admin.balance || 0);
    const commissionPercent = Number(admin.commission || 0);

    // ✅ Log previous balance for reference
    console.log("💳 Previous Balance:", currentBalance.toFixed(2));

    // 🧮 Commission calculation
    const commissionAmount = (basePoints * commissionPercent) / 100;
    const finalDeductPoints = basePoints - commissionAmount;

    console.log("💰 Base Points:", basePoints);
    console.log("🏪 Commission (%):", commissionPercent);
    console.log("💵 Commission Earned:", commissionAmount.toFixed(2));
    console.log("📉 Net Deduction from Balance:", finalDeductPoints.toFixed(2));

    // --- Check sufficient balance ---
    if (currentBalance < finalDeductPoints) {
      await t.rollback();
      return res.status(400).json({
        message: "Insufficient balance.",
        currentBalance,
        required: finalDeductPoints,
      });
    }

    // --- Deduct balance after applying commission ---
    admin.balance = currentBalance - finalDeductPoints;
    await admin.save({ transaction: t });

    console.log("✅ Balance after deduction:", admin.balance.toFixed(2));

    // --- Create Ticket Record ---
    const newTicket = await tickets.create(
      {
        gameTime,
        loginId,
        ticketNumber,
        totalQuatity,
        totalPoints: basePoints,
        drawTime, // ✅ Flattened and cleaned
        commissionApplied: commissionPercent,
        commissionEarned: commissionAmount,
        deductedPoints: finalDeductPoints,
      },
      { transaction: t }
    );

    // --- Commit transaction ---
    await t.commit();

    console.log("🎟️ Ticket saved successfully:", newTicket.id);
    console.log("✅ Final Saved DrawTime:", newTicket.drawTime);

    return res.status(201).json({
      message: "Ticket saved and commission applied successfully.",
      ticket: newTicket,
      commissionApplied: commissionPercent,
      commissionEarned: Number(commissionAmount.toFixed(2)),
      deductedPoints: Number(finalDeductPoints.toFixed(2)),
      previousBalance: Number(currentBalance.toFixed(2)),
      newBalance: Number(admin.balance.toFixed(2)),
    });
  } catch (error) {
    console.error("🔥 Error saving ticket:", error);
    try {
      await t.rollback();
    } catch {
      console.error("⚠️ Transaction rollback failed.");
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
};




function todayDateStrIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // +5:30 hrs in ms
  const istNow = new Date(now.getTime() + istOffset);
  return istNow.toISOString().split("T")[0];
}

/* ---------- Controller ---------- */
export const getPrintedTickets = async (req, res) => {
  try {
    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({ message: "loginId (adminId) is required" });
    }

    const today = todayDateStrIST();
    const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = new Date(tomorrow.getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    console.log(`\n🧾 [REPRINT TICKET CHECK] Admin ID: ${loginId}`);
    console.log(`📅 Today (IST): ${today}`);

    const todaysTickets = await tickets.findAll({
      where: {
        loginId,
        createdAt: {
          [Op.gte]: `${today} 00:00:00`,
          [Op.lt]: `${tomorrowStr} 00:00:00`,
        },
      },
      attributes: [
        "id",
        "gameTime",
        "drawTime",
        "ticketNumber",
        "totalPoints",
        "totalQuatity",
        "createdAt",
      ],
      order: [["id", "DESC"]],
    });

    if (!todaysTickets.length) {
      return res.status(200).json({ message: "No tickets found for today", data: [] });
    }

    const result = todaysTickets.map((t) => {
      let gameDate = "";
      let gameTime = "";
      if (typeof t.gameTime === "string") {
        const [date, ...timeParts] = t.gameTime.split(" ");
        gameDate = date || "";
        gameTime = timeParts.join(" ") || "";
      }

      return {
        ticketNo: t.id,
        gameDate,
        gameTime,
        drawTime: t.drawTime,
        ticketNumber: t.ticketNumber,
        totalPoints: t.totalPoints,
        totalQuatity: t.totalQuatity,
      };
    });

    console.log(`✅ Found ${result.length} tickets for admin ${loginId} (IST Date: ${today}).`);

    return res.status(200).json({
      message: "success",
      date: today,
      data: result,
    });
  } catch (err) {
    console.error("🔥 Error fetching today's tickets:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const subtractAdminBalance = async (req, res) => {
  try {
    const { id, amount } = req.body;

    // Validate input
    if (!id || typeof amount !== "number" || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id or amount." });
    }

    // Find the admin by id
    const admin = await Admin.findOne({ where: { id } });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // Commission logic
    const commissionRate = admin.commission || 0; // percentage, e.g., 5
    const commissionAmount = (commissionRate / 100) * amount;
    const netSubtract = amount - commissionAmount;

    // Optional: round to 2 decimal places for paisa handling
    const netSubtractRounded = Math.round(netSubtract * 100) / 100;

    // Check if the net amount is bigger than the balance
    if (admin.balance < netSubtractRounded) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Your current balance is ${admin.balance}, which is less than the required deduction (${netSubtractRounded}).`
      });
    }

    // Subtract the net amount from the current balance
    admin.balance = admin.balance - netSubtractRounded;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Balance subtracted successfully for admin ID ${id}. Commission deducted: ${commissionAmount}. Net deducted: ${netSubtractRounded}.`,
      updatedBalance: admin.balance,
      commission: commissionAmount,
      netSubtracted: netSubtractRounded,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error while subtracting balance.",
      error: error.message,
    });
  }
};

