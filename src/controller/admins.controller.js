import Admin from "../models/admins.model.js";
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
