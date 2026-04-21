const express = require("express");
const Account = require("../models/Account.js");
const Transaction = require("../models/Transaction.js");
const sequelize = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Helper to verify account ownership and status
const verifyAccount = async (accountId, userId) => {
  const account = await Account.findByPk(accountId);
  if (!account) throw new Error("Account not found");
  if (account.userId !== userId)
    throw new Error("Unauthorized access to this account");
  if (account.status !== "RUNNING") throw new Error("Account is not active");
  return account;
};

// --- 1. DEPOSIT ---
router.post("/deposit", authenticateToken, async (req, res) => {
  try {
    const { accountId, amount, description } = req.body;
    const depositAmount = parseFloat(amount);

    if (depositAmount <= 0)
      return res.status(400).json({ message: "Amount must be greater than zero" });

    const result = await sequelize.transaction(async (t) => {
      const account = await verifyAccount(accountId, req.user.userId);

      // Update balance
      account.balance = parseFloat(account.balance) + depositAmount;
      await account.save({ transaction: t });

      // Create ledger record
      const transactionRecord = await Transaction.create(
        {
          accountId: account.id,
          type: "DEPOSIT",
          amount: depositAmount,
          balanceAfter: account.balance,
          receiverAccountNumber: account.accountNumber, // Updated
          senderAccountNumber: null,                    // Updated
          description: description || "Cash Deposit",
        },
        { transaction: t }
      );

      return { account, transactionRecord };
    });

    res.status(200).json({ message: "Deposit successful", result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 2. WITHDRAW ---
router.post("/withdraw", authenticateToken, async (req, res) => {
  try {
    const { accountId, amount, description } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount <= 0)
      return res.status(400).json({ message: "Amount must be greater than zero" });

    const result = await sequelize.transaction(async (t) => {
      const account = await verifyAccount(accountId, req.user.userId);

      if (parseFloat(account.balance) < withdrawAmount) {
        throw new Error("Insufficient funds");
      }

      // Update balance
      account.balance = parseFloat(account.balance) - withdrawAmount;
      await account.save({ transaction: t });

      // Create ledger record
      const transactionRecord = await Transaction.create(
        {
          accountId: account.id,
          type: "WITHDRAWAL",
          amount: withdrawAmount,
          balanceAfter: account.balance,
          senderAccountNumber: account.accountNumber,   // Updated
          receiverAccountNumber: null,                  // Updated
          description: description || "Cash Withdrawal",
        },
        { transaction: t }
      );

      return { account, transactionRecord };
    });

    res.status(200).json({ message: "Withdrawal successful", result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 3. TRANSFER FUNDS ---
router.post("/transfer", authenticateToken, async (req, res) => {
  try {
    const { senderAccountId, receiverAccountNumber, amount, description } = req.body;
    const transferAmount = parseFloat(amount);

    if (transferAmount <= 0)
      return res.status(400).json({ message: "Amount must be greater than zero" });

    const result = await sequelize.transaction(async (t) => {
      // 1. Verify Sender
      const senderAccount = await verifyAccount(senderAccountId, req.user.userId);
      if (parseFloat(senderAccount.balance) < transferAmount) {
        throw new Error("Insufficient funds for transfer");
      }

      // 2. Verify Receiver
      const receiverAccount = await Account.findOne({ where: { accountNumber: receiverAccountNumber } });
      if (!receiverAccount || receiverAccount.status !== "RUNNING") {
        throw new Error("Invalid or inactive receiver account");
      }

      // Prevent sending to self in the exact same account
      if (senderAccount.id === receiverAccount.id) {
        throw new Error("Cannot transfer to the same account");
      }

      // 3. Update Balances
      senderAccount.balance = parseFloat(senderAccount.balance) - transferAmount;
      await senderAccount.save({ transaction: t });

      receiverAccount.balance = parseFloat(receiverAccount.balance) + transferAmount;
      await receiverAccount.save({ transaction: t });

      // 4. Create Double-Entry Ledger Records
      
      // OUT record for the sender's history
      const senderTx = await Transaction.create({
        accountId: senderAccount.id,
        type: "TRANSFER_OUT",
        amount: transferAmount,
        balanceAfter: senderAccount.balance,
        senderAccountNumber: senderAccount.accountNumber,     // Updated
        receiverAccountNumber: receiverAccount.accountNumber, // Updated
        description: description || `Transfer to ${receiverAccountNumber}`,
      }, { transaction: t });

      // IN record for the receiver's history
      const receiverTx = await Transaction.create({
        accountId: receiverAccount.id,
        type: "TRANSFER_IN",
        amount: transferAmount,
        balanceAfter: receiverAccount.balance,
        senderAccountNumber: senderAccount.accountNumber,     // Updated
        receiverAccountNumber: receiverAccount.accountNumber, // Updated
        description: description || `Transfer from ${senderAccount.accountNumber}`,
      }, { transaction: t });

      return { senderTx, receiverTx };
    });

    res.status(200).json({ message: "Transfer successful", result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 4. GET TRANSACTION HISTORY ---
router.get("/:accountId", authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    // console.log(accountId)

    // Verify they own the account before showing history
    await verifyAccount(accountId, req.user.userId);

    const history = await Transaction.findAll({
      where: { accountId },
      order: [["createdAt", "DESC"]], // Newest first
    });

    res.json(history);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;