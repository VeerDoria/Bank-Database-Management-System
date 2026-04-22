// --- ADMIN: Run Raw SQL Query ---
const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const sequelize = require("../config/db"); // Importing the Sequelize instance
const User = require("../models/User");
const Account = require("../models/Account"); // NEW: Imported Account model
const Loan = require("../models/Loan");

const router = express.Router();

// --- 18. ADMIN: Get Comprehensive Loan Details by Loan Number ---
router.get(
  "/loan-details/:loanNumber",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { loanNumber } = req.params;

      // 1. Find the specific loan
      const loan = await Loan.findOne({
        where: { loanNumber }
      });

      if (!loan) {
        return res.status(404).json({ message: "Loan not found with this number." });
      }

      // 2. Fetch the linked Account for context
      const account = await Account.findByPk(loan.accountId, {
        attributes: ["accountNumber", "accountType", "status", "balance", "userId"]
      });

      // 3. Fetch the Owner's basic details for context
      let owner = null;
      if (account) {
        owner = await User.findByPk(account.userId, {
          attributes: ["fullName", "email", "mobileNumber"]
        });
      }

      res.status(200).json({
        loanDetails: loan,
        linkedAccount: account,
        owner: owner
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// --- 17. ADMIN: Get Comprehensive Account Details by Account Number ---
router.get(
  "/account-details/:accountNumber",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { accountNumber } = req.params;

      // 1. Find the specific account
      const account = await Account.findOne({
        where: { accountNumber },
      });

      if (!account) {
        return res.status(404).json({ message: "Account not found." });
      }

      // 2. Get the Owner's details
      const owner = await User.findByPk(account.userId, {
        attributes: [
          "fullName",
          "email",
          "mobileNumber",
          "address",
          "dob",
          "gender",
        ],
      });

      // 3. Get all loans strictly linked to this account
      const loans = await Loan.findAll({
        where: { accountId: account.id },
        order: [["createdAt", "DESC"]],
      });

      res.status(200).json({
        accountDetails: {
          id: account.id,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          status: account.status,
          balance: parseFloat(account.balance).toFixed(2),
          interestRate: account.interestRate,
          openingDate: account.openingDate,
          createdAt: account.createdAt,
        },
        owner,
        linkedLoans: loans,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- 16. ADMIN: Get Comprehensive User Details by Email ---
router.get(
  "/user-details/:email",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { email } = req.params;

      // 1. Find the User (excluding the password hash for security)
      const user = await User.findOne({
        where: { email },
        attributes: { exclude: ["password"] },
      });

      if (!user) {
        return res
          .status(404)
          .json({ message: "User not found with this email." });
      }

      // 2. Fetch all accounts owned by this user
      const accounts = await Account.findAll({
        where: { userId: user.id },
        order: [["createdAt", "DESC"]],
      });

      // 3. Fetch all loans attached to these accounts
      const accountNumbers = accounts
        .map((acc) => acc.accountNumber)
        .filter(Boolean);
      let loans = [];
      if (accountNumbers.length > 0) {
        loans = await Loan.findAll({
          where: { accountNumber: accountNumbers },
          order: [["createdAt", "DESC"]],
        });
      }

      // 4. Calculate total cumulative balance across all their accounts
      const totalBalance = accounts.reduce(
        (sum, acc) => sum + parseFloat(acc.balance || 0),
        0,
      );

      res.status(200).json({
        user,
        financialSummary: {
          totalAccounts: accounts.length,
          totalCumulativeBalance: totalBalance.toFixed(2),
          totalLoans: loans.length,
        },
        accounts,
        loans,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- 15. ADMIN: Get Database Statistics Overview ---
router.get(
  "/db-stats",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      // Run all database count queries simultaneously for maximum performance
      // console.log('hi')
      const [
        totalUsers,
        totalAccounts,
        savingsAccounts,
        currentAccounts,
        runningAccounts,
        closedAccounts,
        pendingAccounts,
        totalLoans,
        activeLoans,
        pendingLoans,
        closedLoans,
        defaultedLoans,
        rejectedLoans,
        personalLoans,
        homeLoans,
        carLoans,
        educationLoans,
        businessLoans,
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
        Loan.count({ where: { loanType: "BUSINESS" } }),
      ]);

      res.status(200).json({
        users: { total: totalUsers },
        accounts: {
          total: totalAccounts,
          byType: { savings: savingsAccounts, current: currentAccounts },
          byStatus: {
            running: runningAccounts,
            closed: closedAccounts,
            pending: pendingAccounts,
          },
        },
        loans: {
          total: totalLoans,
          byStatus: {
            active: activeLoans,
            pending: pendingLoans,
            closed: closedLoans,
            defaulted: defaultedLoans,
            rejected: rejectedLoans,
          },
          byType: {
            personal: personalLoans,
            home: homeLoans,
            car: carLoans,
            education: educationLoans,
            business: businessLoans,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

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
        return res.status(400).json({
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
