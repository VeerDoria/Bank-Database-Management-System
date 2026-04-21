const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Account = require("../models/Account"); // NEW: Imported Account model
const { authenticateToken } = require("../middleware/auth"); // NEW: Imported middleware

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
};

// --- 1. USER SIGNUP ---
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, address, mobileNumber, dob, gender } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : [];
    const assignedRole = adminEmails.includes(email) ? "ADMIN" : "CUSTOMER"; // "USER" acts as Customer

    const user = await User.create({
      email,
      password,
      role: assignedRole,
      fullName,
      address,
      mobileNumber,
      dob,
      gender,
    });

    res.status(201).json({
      token: generateToken(user),
      user: { email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. USER / ADMIN LOGIN ---
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ token: generateToken(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. GET USER PROFILE (NEW) ---
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    // 1. Fetch user data (exclude the password hash for security)
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ["password"] }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Fetch all accounts belonging to this user
    const accounts = await Account.findAll({ 
      where: { userId: user.id } 
    });

    // 3. Tally up the account types
    const savingsCount = accounts.filter(acc => acc.accountType === "SAVINGS").length;
    const currentCount = accounts.filter(acc => acc.accountType === "CURRENT").length;

    // 4. Send the combined flat object back to the frontend
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      address: user.address,
      mobileNumber: user.mobileNumber,
      dob: user.dob,
      gender: user.gender,
      role: user.role,
      joinedDate: user.createdAt,
      // Account Stats
      totalAccounts: accounts.length,
      savingsAccountsCount: savingsCount,
      currentAccountsCount: currentCount
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;