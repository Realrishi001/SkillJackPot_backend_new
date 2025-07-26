import Admin from "../models/admins.model.js";
import { tickets } from "../models/ticket.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Create Admin Controller
export const createAdmin = async (req, res) => {
  try {
    const {
      fullName,
      userName,
      address,
      phoneNumber,
      emailAddress,
      password
    } = req.body;

    // Simple required fields validation
    if (
      !fullName ||
      !userName ||
      !address ||
      !phoneNumber ||
      !emailAddress ||
      !password
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check for existing email
    const existing = await Admin.findOne({ where: { emailAddress } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // Create admin (password will be hashed by hook)
    const admin = await Admin.create({
      fullName,
      userName,
      address,
      phoneNumber,
      emailAddress,
      password
    });

    // Don’t return password in response
    const { password: _pw, ...adminData } = admin.toJSON();

    res.status(201).json({
      message: "Admin created successfully.",
      admin: adminData
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};


export const getAllAdmins = async (req, res) => {
  try {
    // Only select userName, fullName, phoneNumber, emailAddress
    const admins = await Admin.findAll({
      attributes: ["userName", "fullName", "phoneNumber", "emailAddress"]
    });

    res.status(200).json({
      message: "Admins fetched successfully.",
      admins
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { userName, password } = req.body;

    if (!userName || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const admin = await Admin.findOne({ where: { userName } });
    if (!admin) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const payload = {
      id: admin.id,
      userName: admin.userName
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

    res.status(200).json({
      message: "Login Successfull!",
      token
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};


export const updateAdminCommission = async (req, res) => {
  try {
    const { userName, commission } = req.body;

    // Input validation
    if (!userName || typeof commission !== "number" || commission < 0) {
      return res.status(400).json({ message: "Invalid userName or commission." });
    }

    // Find admin by userName
    const admin = await Admin.findOne({ where: { userName } });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Update commission
    admin.commission = commission;
    await admin.save();

    res.status(200).json({
      message: "Commission updated successfully.",
      admin,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

export const getAdminUsernamesAndCommissions = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ["userName", "commission"], // Only these two fields
    });

    res.status(200).json({ admins });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

export const deleteAdminByUserName = async (req, res) => {
  try {
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({ message: "userName is required." });
    }

    // Find and delete the admin
    const deleted = await Admin.destroy({ where: { userName } });

    if (!deleted) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.status(200).json({ message: "Admin deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};


export const mainAdminLogin = async (req, res) => {
  try {
    const { adminId, password } = req.body;

    console.log(adminId, password);
    // Check required fields
    if (!adminId || !password) {
      return res.status(400).json({ message: "Admin ID and password are required." });
    }

    // Get hashes from env
    const adminIdHash = process.env.ADMIN_ID;
    const adminPasswordHash = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET; // fallback

    // Compare admin ID
    const isIdMatch = await bcrypt.compare(adminId, adminIdHash);
    if (!isIdMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Compare password
    const isPassMatch = await bcrypt.compare(password, adminPasswordHash);
    if (!isPassMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Issue JWT
    const payload = {
      role: "main_admin",
      adminId: adminId,
      userName: process.env.MAIN_ADMIN_USERNAME || "main_admin"
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: "1d" });

    res.status(200).json({
      success: true,                    
      message: "Main Admin Login Successful!",
      token
    });


  } catch (error) {
    console.error("Main admin login error:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};


// update balance
export const addAdminBalance = async (req, res) => {
  try {
    const { userName, amount } = req.body;

    // Validate input
    if (!userName || typeof amount !== "number" || isNaN(amount)) {
      return res.status(400).json({ success: false, message: "Invalid userName or amount." });
    }

    // Find the admin
    const admin = await Admin.findOne({ where: { userName } });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // Add the amount to the current balance
    admin.balance = admin.balance + amount;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Balance updated successfully for ${userName}.`,
      updatedBalance: admin.balance,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error while updating balance.",
      error: error.message,
    });
  }
};


export const getAdminUsernamesAndBalance = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ["userName", "balance"], 
    });

    res.status(200).json({ admins });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// for shop report
export const getAdminDetails = async (req, res) => {
  try {
    // Fetch latest winning percentage (optional)
    const latestWinning = await winningPercentage.findOne({
      order: [["createdAt", "DESC"]],
      attributes: ["percentage"],
    });
    const winningPercent = latestWinning ? parseFloat(latestWinning.percentage) : 0;

    // Fetch all admins
    const admins = await Admin.findAll({
      attributes: ["id", "userName", "commission", "balance"],
    });

    const adminDetails = await Promise.all(
      admins.map(async (admin) => {
        // Fetch tickets for this admin
        const ticketsData = await tickets.findAll({
          where: { loginId: admin.id },
          attributes: ["totalPoints"],
        });

        // Total tickets count
        const totalTickets = ticketsData.length;

        // Total points sum
        const totalPoints = ticketsData.reduce((sum, t) => sum + (parseFloat(t.totalPoints) || 0), 0);

        // Commission (shop amount)
        const shopAmount = (totalPoints * (admin.commission || 0)) / 100;

        // Net amount
        const netAmount = totalPoints - shopAmount;

        // Winning amount
        const winningAmount = (netAmount * winningPercent) / 100;

        return {
          id: admin.id,
          userName: admin.userName,
          commission: admin.commission,
          balance: admin.balance,
          totalTickets,
          totalPoints: Number(totalPoints.toFixed(2)),
          shopAmount: Number(shopAmount.toFixed(2)),
          netAmount: Number(netAmount.toFixed(2)),
          winningAmount: Number(winningAmount.toFixed(2)),
        };
      })
    );

    res.status(200).json({ success: true, admins: adminDetails });
  } catch (error) {
    console.error("Error fetching admin details with net/shop amounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin details with net/shop amounts.",
      error: error.message,
    });
  }
};
