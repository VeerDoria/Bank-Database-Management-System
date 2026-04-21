const express = require("express");
const User = require("../models/User.js");
const Account = require("../models/Account.js");
const Transaction = require("../models/Transaction.js");
const sequelize = require("../config/db.js");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.js");

const router = express.Router();

// --- NEW: Bulletproof Unique Account Number Generator ---
const generateUniqueAccountNumber = async () => {
  let isUnique = false;
  let newAccountNumber;

  while (!isUnique) {
    // Generate a random 12-digit string
    newAccountNumber = Math.floor(
      100000000000 + Math.random() * 900000000000,
    ).toString();

    // Check if any account in the DB already has this number
    const existingAccount = await Account.findOne({
      where: { accountNumber: newAccountNumber },
    });

    // If no account is found, it's unique! Break the loop.
    if (!existingAccount) {
      isUnique = true;
    }
  }

  return newAccountNumber;
};

// --- 1. USER: Request a New Account ---
router.post("/request", authenticateToken, async (req, res) => {
  try {
    const { accountType, openingFeePaid } = req.body;

    // Create the account in a PENDING state
    const newAccount = await Account.create({
      userId: req.user.userId,
      accountType,
      status: "PENDING",
      openingFeePaid: openingFeePaid || false,
    });

    res.status(201).json({
      message:
        "Account request submitted successfully. Awaiting admin approval.",
      account: newAccount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 2. ADMIN: View all Pending Requests ---
router.get(
  "/pending",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const pendingAccounts = await Account.findAll({
        where: { status: "PENDING" },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["fullName", "email", "mobileNumber"],
          },
        ],
      });

      res.json(pendingAccounts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- 3. ADMIN: Approve and Open the Account ---
router.put(
  "/approve/:accountId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await Account.findByPk(accountId);

      if (!account)
        return res.status(404).json({ message: "Account not found" });
      if (account.status !== "PENDING")
        return res
          .status(400)
          .json({ message: "Account is not in pending status" });
      if (!account.openingFeePaid)
        return res
          .status(400)
          .json({ message: "Cannot approve: Opening fee not paid" });

      const interestRate = account.accountType === "SAVINGS" ? 4.5 : 0.0;

      account.status = "RUNNING";
      account.accountNumber = await generateUniqueAccountNumber(); // Updated to use async generator
      account.interestRate = interestRate;
      account.openingDate = new Date();

      await account.save();

      res.json({
        message: "Account approved and opened successfully.",
        account,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- 4. ADMIN: Manually Create & Fund Account ---
router.post(
  "/create-manual",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const {
        email,
        mobileNumber,
        accountType,
        initialBalance,
        interestRate,
        openingDate,
      } = req.body;

      const balanceAmt = parseFloat(initialBalance) || 0;

      const result = await sequelize.transaction(async (t) => {
        const targetUser = await User.findOne({
          where: { email, mobileNumber },
        });

        if (!targetUser) {
          throw new Error(
            "User not found with the provided email and mobile number",
          );
        }

        // Generate the guaranteed unique number BEFORE creating the account
        const uniqueAccountNumber = await generateUniqueAccountNumber();

        const newAccount = await Account.create(
          {
            userId: targetUser.id,
            accountType,
            status: "RUNNING",
            balance: balanceAmt,
            interestRate:
              interestRate || (accountType === "SAVINGS" ? 4.5 : 0.0),
            openingDate: openingDate || new Date(),
            openingFeePaid: true,
            accountNumber: uniqueAccountNumber, // Passed the unique number here
          },
          { transaction: t },
        );

        if (balanceAmt > 0) {
          const bankUser = await User.findOne({
            where: { email: "bank@gmail.com" },
          });

          let bankAccountNumber = null;

          if (bankUser) {
            const bankAccount = await Account.findOne({
              where: { userId: bankUser.id },
            });
            if (bankAccount) {
              bankAccountNumber = bankAccount.accountNumber; // Get the number, not the ID
            }
          }

          // FIXED: Now properly uses senderAccountNumber and receiverAccountNumber
          await Transaction.create(
            {
              accountId: newAccount.id,
              type: "DEPOSIT",
              amount: balanceAmt,
              balanceAfter: balanceAmt,
              senderAccountNumber: bankAccountNumber,
              receiverAccountNumber: newAccount.accountNumber,
              description: "Initial Balance Setup by Admin",
            },
            { transaction: t },
          );
        }

        return newAccount;
      });

      res.status(201).json({
        message: "Account manually created and funded successfully",
        account: result,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

// --- 5. USER: Get My Accounts ---
router.get("/my-accounts", authenticateToken, async (req, res) => {
  try {
    const myAccounts = await Account.findAll({
      where: { userId: req.user.userId },
    });
    res.json(myAccounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 5. ADMIN: Close an Account ---
router.put(
  "/close",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { accountNumber } = req.body;

      if (!accountNumber) {
        return res.status(400).json({ message: "Account number is required" });
      }

      // Find the account by its 12-digit number
      const account = await Account.findOne({ where: { accountNumber } });

      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (account.status === "CLOSED") {
        return res.status(400).json({ message: "Account is already closed" });
      }

      // Real-world banking rule: Ensure balance is 0 before closing
      // (Optional: You can remove this check if you want to force-close anyway)
      // if (parseFloat(account.balance) > 0) {
      //   return res.status(400).json({
      //     message: `Cannot close account. Please withdraw the remaining balance of ₹${account.balance} first.`,
      //   });
      // }

      // Update status to CLOSED
      account.status = "CLOSED";
      await account.save();

      res.json({
        message: `Account ${accountNumber} has been successfully closed.`,
        account,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- 6. USER: Close My Account (Requires Exact ₹30 Balance) ---
// --- 6. USER: Close My Account (Requires Exact ₹30 Balance) ---
router.post("/close-my-account", authenticateToken, async (req, res) => {
  try {
    // UPDATED: Now expecting accountNumber instead of accountId
    const { accountNumber } = req.body; 
    const userId = req.user.userId; // Guaranteed by the token

    const result = await sequelize.transaction(async (t) => {
      // 1. Verify the user owns this account and it is active
      const account = await Account.findOne({
        where: { accountNumber, userId }, // UPDATED: Searching by accountNumber
      });

      if (!account) throw new Error("Account not found or unauthorized");
      if (account.status !== "RUNNING")
        throw new Error("Account is not active");

      // 2. Strict Balance Check
      const currentBalance = parseFloat(account.balance);
      if (currentBalance !== 30.0) {
        throw new Error(
          `Closure failed. Your balance must be exactly ₹30.00 to pay the closure fee. Current balance is ₹${currentBalance.toFixed(2)}.`,
        );
      }

      // 3. Find the Bank's Master Account
      const bankUser = await User.findOne({
        where: { email: "bank@gmail.com" },
      });
      if (!bankUser) throw new Error("Bank system user not found");

      const bankAccount = await Account.findOne({
        where: { userId: bankUser.id },
      });
      if (!bankAccount) throw new Error("Bank master account not found");

      // 4. Update Balances and Status
      account.balance = 0.0;
      account.status = "CLOSED";
      await account.save({ transaction: t });

      bankAccount.balance = parseFloat(bankAccount.balance) + 30.0;
      await bankAccount.save({ transaction: t });

      // 5. Create Double-Entry Ledger Records

      // OUT record for the user (The fee deduction)
      await Transaction.create(
        {
          accountId: account.id,
          type: "TRANSFER_OUT",
          amount: 30.0,
          balanceAfter: 0.0,
          senderAccountNumber: account.accountNumber,
          receiverAccountNumber: bankAccount.accountNumber,
          description: "Account Closure Fee",
        },
        { transaction: t },
      );

      // IN record for the bank (Receiving the fee)
      await Transaction.create(
        {
          accountId: bankAccount.id,
          type: "TRANSFER_IN",
          amount: 30.0,
          balanceAfter: bankAccount.balance,
          senderAccountNumber: account.accountNumber,
          receiverAccountNumber: bankAccount.accountNumber,
          description: `Closure Fee from ${account.accountNumber}`,
        },
        { transaction: t },
      );

      return account;
    });

    res.status(200).json({
      message: "Account successfully closed. ₹30 closure fee processed.",
      account: result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// --- 7. ADMIN: Reactivate a Closed Account ---
router.put(
  "/activate",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { accountNumber } = req.body;

      if (!accountNumber) {
        return res.status(400).json({ message: "Account number is required" });
      }

      // Find the account by its 12-digit number
      const account = await Account.findOne({ where: { accountNumber } });

      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (account.status === "RUNNING") {
        return res.status(400).json({ message: "Account is already active." });
      }

      if (account.status === "PENDING") {
        return res.status(400).json({ 
            message: "Account is currently PENDING. Please use the Account Requests tab to approve it." 
        });
      }

      // Update status back to RUNNING
      account.status = "RUNNING";
      await account.save();

      res.json({
        message: `Account ${accountNumber} has been successfully reactivated.`,
        account,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
