// --- ADMIN: Run Raw SQL Query ---
const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const  sequelize  = require("../config/db"); // Importing the Sequelize instance
const User = require("../models/User");
const Account = require("../models/Account"); // NEW: Imported Account model
const Loan = require("../models/Loan"); 

const router = express.Router();

// --- 15. ADMIN: Get Database Statistics Overview ---
router.get("/db-stats", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    // Run all database count queries simultaneously for maximum performance
    // console.log('hi')
    const [
      totalUsers,
      totalAccounts, savingsAccounts, currentAccounts, runningAccounts, closedAccounts, pendingAccounts,
      totalLoans, activeLoans, pendingLoans, closedLoans, defaultedLoans, rejectedLoans,
      personalLoans, homeLoans, carLoans, educationLoans, businessLoans
    ] = await Promise.all([
      User.count(),
      Account.count(),
      Account.count({ where: { accountType: "SAVINGS" } }),
      Account.count({ where: { accountType: "CURRENT" } }),
      Account.count({ where: { status: "RUNNING" } }),
      Account.count({ where: { status: "CLOSED" } }),
      Account.count({ where: { status: "PENDING" } }),
      Loan.count(),
      Loan.count({ where: { status: "ACTIVE" } }),
      Loan.count({ where: { status: "PENDING" } }),
      Loan.count({ where: { status: "CLOSED" } }),
      Loan.count({ where: { status: "DEFAULTED" } }),
      Loan.count({ where: { status: "REJECTED" } }),
      Loan.count({ where: { loanType: "PERSONAL" } }),
      Loan.count({ where: { loanType: "HOME" } }),
      Loan.count({ where: { loanType: "CAR" } }),
      Loan.count({ where: { loanType: "EDUCATION" } }),
      Loan.count({ where: { loanType: "BUSINESS" } })
    ]);

    res.status(200).json({
      users: { total: totalUsers },
      accounts: {
        total: totalAccounts,
        byType: { savings: savingsAccounts, current: currentAccounts },
        byStatus: { running: runningAccounts, closed: closedAccounts, pending: pendingAccounts }
      },
      loans: {
        total: totalLoans,
        byStatus: { active: activeLoans, pending: pendingLoans, closed: closedLoans, defaulted: defaultedLoans, rejected: rejectedLoans },
        byType: { personal: personalLoans, home: homeLoans, car: carLoans, education: educationLoans, business: businessLoans }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/run-sql",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      // 1. Let's see exactly what Express thinks the body is
      // console.log("Incoming Payload:", req.body);

      // 2. Add || {} to prevent the server crash!
      const { query } = req.body || {};

      if (!query) {
        return res
          .status(400)
          .json({
            message: "SQL query is required. Check if req.body is empty!",
          });
      }

      // 🛡️ SAFETY LOCK: Prevent destructive commands
      // const upperQuery = query.trim().toUpperCase();
      // if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("SHOW") && !upperQuery.startsWith("DESCRIBE")) {
      //   return res.status(403).json({
      //     error: "Safety Lock Active: Only SELECT, SHOW, or DESCRIBE queries are allowed in this console."
      //   });
      // }

      // Execute the raw query using Sequelize
      const [results, metadata] = await sequelize.query(query);

      res.status(200).json({ results, metadata });
    } catch (error) {
      res.status(400).json({ error: error.message || "SQL Execution Failed" });
    }
  },
);

module.exports = router;
