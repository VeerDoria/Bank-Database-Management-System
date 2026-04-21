const express = require("express");
const Loan = require("../models/Loan.js");
const Account = require("../models/Account.js");
const User = require("../models/User.js");
const Transaction = require("../models/Transaction.js");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.js");
const sequelize = require("../config/db.js");

const router = express.Router();

// --- 12. ADMIN: Get All Pending Loan Requests ---
router.get(
  "/pending-loans",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const pendingLoans = await Loan.findAll({
        where: { status: "PENDING" },
        order: [["createdAt", "ASC"]],
      });
      res.status(200).json(pendingLoans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// --- 13. ADMIN: Approve & Disburse Loan ---
router.put(
  "/approve-loan/:loanId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const { loanId } = req.params;

      const result = await sequelize.transaction(async (t) => {
        // 1. Find the pending loan
        const loan = await Loan.findByPk(loanId, { transaction: t });
        if (!loan) throw new Error("Loan not found.");
        if (loan.status !== "PENDING") throw new Error("Loan is not pending.");

        // 2. Find User's Account
        const account = await Account.findOne({ 
            where: { accountNumber: loan.accountNumber }, 
            transaction: t 
        });
        if (!account || account.status !== "RUNNING") throw new Error("User account is invalid or inactive.");

        // 3. Find Bank's Master Account
        const bankUser = await User.findOne({ where: { email: "bank@gmail.com" }, transaction: t });
        if (!bankUser) throw new Error("Bank system user not found.");
        const bankAccount = await Account.findOne({ where: { userId: bankUser.id }, transaction: t });
        if (!bankAccount) throw new Error("Bank master account not found.");

        const principal = parseFloat(loan.baseAmount);

        // 4. Update the Loan Schedule (Clock starts NOW)
        const today = new Date();
        const nextEmiDate = new Date(today);
        nextEmiDate.setMonth(today.getMonth() + 1);
        
        const deadlineDate = new Date(today);
        deadlineDate.setMonth(today.getMonth() + loan.emisLeft);

        loan.issuedDate = today;
        loan.nextEmiDate = nextEmiDate;
        loan.deadlineDate = deadlineDate;
        loan.status = "ACTIVE";
        await loan.save({ transaction: t });

        // 5. Move the Money
        account.balance = parseFloat(account.balance) + principal;
        await account.save({ transaction: t });

        bankAccount.balance = parseFloat(bankAccount.balance) - principal;
        await bankAccount.save({ transaction: t });

        // 6. Create Receipts
        await Transaction.create({
          accountId: bankAccount.id,
          type: "TRANSFER_OUT",
          amount: principal,
          balanceAfter: bankAccount.balance,
          senderAccountNumber: bankAccount.accountNumber,
          receiverAccountNumber: account.accountNumber,
          description: `Loan Disbursed: ${loan.loanNumber}`
        }, { transaction: t });

        await Transaction.create({
          accountId: account.id,
          type: "DEPOSIT",
          amount: principal,
          balanceAfter: account.balance,
          senderAccountNumber: bankAccount.accountNumber,
          receiverAccountNumber: account.accountNumber,
          description: `Loan Disbursed: ${loan.loanNumber}`
        }, { transaction: t });

        return loan;
      });

      res.status(200).json({ message: "Loan approved and funds disbursed!", loan: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// --- 14. ADMIN: Reject Loan Request ---
router.put(
  "/reject-loan/:loanId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const loan = await Loan.findByPk(req.params.loanId);
      if (!loan) return res.status(404).json({ message: "Loan not found." });
      if (loan.status !== "PENDING") return res.status(400).json({ message: "Only pending loans can be rejected." });

      loan.status = "REJECTED";
      loan.nextEmiAmount = 0; // Wipe the projected EMI
      await loan.save();

      res.status(200).json({ message: "Loan request has been rejected." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// --- 11. USER: Request a New Loan ---
// --- 11. USER: Request a New Loan (With ₹20 Fee) ---
router.post("/request-loan", authenticateToken, async (req, res) => {
  try {
    const { accountNumber, loanType, baseAmount, emisLeft } = req.body;
    const userId = req.user.userId;

    const principal = parseFloat(baseAmount);
    const months = parseInt(emisLeft);

    if (principal < 1000) return res.status(400).json({ message: "Minimum loan request is ₹1000." });
    if (months <= 0) return res.status(400).json({ message: "Loan duration must be at least 1 month." });

    const result = await sequelize.transaction(async (t) => {
      // 1. Verify the user actually owns this account
      const account = await Account.findOne({ where: { accountNumber, userId }, transaction: t });
      if (!account) throw new Error("Account not found or unauthorized.");
      if (account.status !== "RUNNING") throw new Error("Account must be active to request a loan.");

      // 2. CHECK FOR THE ₹20 PROCESSING FEE
      if (parseFloat(account.balance) < 20.00) {
        throw new Error(`Insufficient funds. A non-refundable ₹20.00 processing fee is required, but your balance is ₹${parseFloat(account.balance).toFixed(2)}.`);
      }

      // 3. Find the Bank's Master Account to receive the fee
      const bankUser = await User.findOne({ where: { email: "bank@gmail.com" }, transaction: t });
      if (!bankUser) throw new Error("Bank system user not found.");
      const bankAccount = await Account.findOne({ where: { userId: bankUser.id }, transaction: t });
      if (!bankAccount) throw new Error("Bank master account not found.");

      // 4. Auto-assign estimated Interest Rates based on Loan Type
      let rate = 8.5; 
      if (loanType === "HOME") rate = 7.5;
      if (loanType === "EDUCATION") rate = 6.5;
      if (loanType === "CAR") rate = 9.0;
      if (loanType === "BUSINESS") rate = 10.0;
      if (loanType === "PERSONAL") rate = 12.0;

      // 5. Do the Financial Math
      const emiAmount = calculateEMI(principal, rate, months);
      const uniqueLoanNumber = await generateUniqueLoanNumber();

      const today = new Date();
      const projectedDeadline = new Date(today);
      projectedDeadline.setMonth(today.getMonth() + months);

      // 6. Deduct the ₹20 Fee
      account.balance = parseFloat(account.balance) - 20.00;
      await account.save({ transaction: t });

      bankAccount.balance = parseFloat(bankAccount.balance) + 20.00;
      await bankAccount.save({ transaction: t });

      // 7. Write the Double-Entry Ledger Receipts for the Fee
      await Transaction.create({
        accountId: account.id,
        type: "TRANSFER_OUT",
        amount: 20.00,
        balanceAfter: account.balance,
        senderAccountNumber: account.accountNumber,
        receiverAccountNumber: bankAccount.accountNumber,
        description: `Loan Processing Fee: ${uniqueLoanNumber}`
      }, { transaction: t });

      await Transaction.create({
        accountId: bankAccount.id,
        type: "TRANSFER_IN",
        amount: 20.00,
        balanceAfter: bankAccount.balance,
        senderAccountNumber: account.accountNumber,
        receiverAccountNumber: bankAccount.accountNumber,
        description: `Processing Fee Received: ${uniqueLoanNumber}`
      }, { transaction: t });

      // 8. Create the PENDING Loan Record
      const newLoan = await Loan.create({
        accountId: account.id,
        accountNumber: account.accountNumber,
        loanNumber: uniqueLoanNumber,
        loanType,
        baseAmount: principal,
        interestRate: rate,
        nextEmiAmount: emiAmount,
        emisLeft: months,
        deadlineDate: projectedDeadline,
        status: "PENDING"
      }, { transaction: t });

      return newLoan;
    });

    res.status(201).json({
      message: "Loan request submitted successfully. ₹20 fee processed.",
      loan: result
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 10. USER: Pay Loan EMI ---
router.post("/pay-emi", authenticateToken, async (req, res) => {
  try {
    const { loanId, fromAccountId } = req.body;
    const userId = req.user.userId;

    const result = await sequelize.transaction(async (t) => {
      // 1. Fetch the Loan
      const loan = await Loan.findByPk(loanId, { transaction: t });
      if (!loan) throw new Error("Loan not found.");
      if (loan.status !== "ACTIVE") throw new Error("This loan is not currently active.");
      if (loan.emisLeft <= 0) throw new Error("This loan is already fully paid.");

      // 2. Fetch the User's Paying Account
      const fromAccount = await Account.findOne({
        where: { id: fromAccountId, userId },
        transaction: t
      });
      if (!fromAccount) throw new Error("Payment account not found or unauthorized.");
      if (fromAccount.status !== "RUNNING") throw new Error("Payment account must be active to send money.");

      const emiAmount = parseFloat(loan.nextEmiAmount);

      // 3. Strict Balance Check
      if (parseFloat(fromAccount.balance) < emiAmount) {
        throw new Error(
          `Insufficient funds. Your EMI is ₹${emiAmount.toFixed(2)}, but account ${fromAccount.accountNumber} only has ₹${parseFloat(fromAccount.balance).toFixed(2)}.`
        );
      }

      // 4. Fetch Bank's Master Account
      const bankUser = await User.findOne({ where: { email: "bank@gmail.com" }, transaction: t });
      if (!bankUser) throw new Error("Bank system user not found.");
      const bankAccount = await Account.findOne({ where: { userId: bankUser.id }, transaction: t });
      if (!bankAccount) throw new Error("Bank master account not found.");

      // 5. Move the Money!
      fromAccount.balance = parseFloat(fromAccount.balance) - emiAmount;
      await fromAccount.save({ transaction: t });

      bankAccount.balance = parseFloat(bankAccount.balance) + emiAmount;
      await bankAccount.save({ transaction: t });

      // 6. Create Ledger Transactions (Double-Entry)
      await Transaction.create({
        accountId: fromAccount.id,
        type: "TRANSFER_OUT",
        amount: emiAmount,
        balanceAfter: fromAccount.balance,
        senderAccountNumber: fromAccount.accountNumber,
        receiverAccountNumber: bankAccount.accountNumber,
        description: `EMI Payment for Loan: ${loan.loanNumber}`
      }, { transaction: t });

      await Transaction.create({
        accountId: bankAccount.id,
        type: "TRANSFER_IN",
        amount: emiAmount,
        balanceAfter: bankAccount.balance,
        senderAccountNumber: fromAccount.accountNumber,
        receiverAccountNumber: bankAccount.accountNumber,
        description: `EMI Received for Loan: ${loan.loanNumber}`
      }, { transaction: t });

      // 7. Update the Loan Schedule
      loan.emisLeft -= 1;
      
      if (loan.emisLeft === 0) {
        // Loan is fully paid off!
        loan.status = "CLOSED";
        loan.nextEmiAmount = 0;
        loan.nextEmiDate = null;
      } else {
        // Push the next payment date forward by exactly 1 month
        const currentEmiDate = new Date(loan.nextEmiDate);
        currentEmiDate.setMonth(currentEmiDate.getMonth() + 1);
        loan.nextEmiDate = currentEmiDate;
      }

      await loan.save({ transaction: t });

      return { loan, emiAmount };
    });

    res.status(200).json({
      message: `EMI of ₹${result.emiAmount.toFixed(2)} paid successfully!`,
      loan: result.loan
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- 8. USER: Get All Loans for a Specific Account ---
router.get("/:accountNumber/loans", authenticateToken, async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const userId = req.user.userId; // Securely pulled from the JWT token

    // 1. Verify the user actually owns this specific account
    const account = await Account.findOne({
      where: { accountNumber, userId },
    });

    if (!account) {
      return res
        .status(403)
        .json({ message: "Account not found or unauthorized access." });
    }

    // 2. Fetch all loans linked to this account number
    const loans = await Loan.findAll({
      where: { accountNumber },
      order: [["createdAt", "DESC"]], // Show the most recently requested loans first
    });

    res.status(200).json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Generate a unique 10-digit Loan Number (e.g., "LN-84729103")
const generateUniqueLoanNumber = async () => {
  let isUnique = false;
  let newLoanNumber;
  while (!isUnique) {
    const randomDigits = Math.floor(
      10000000 + Math.random() * 90000000,
    ).toString();
    newLoanNumber = `LN-${randomDigits}`;
    const existingLoan = await Loan.findOne({
      where: { loanNumber: newLoanNumber },
    });
    if (!existingLoan) isUnique = true;
  }
  return newLoanNumber;
};

// Helper: Standard Financial EMI Calculation
const calculateEMI = (principal, annualInterestRate, months) => {
  if (annualInterestRate === 0) return principal / months;

  const monthlyRate = annualInterestRate / 12 / 100;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);

  return parseFloat(emi.toFixed(2));
};  

// --- 9. ADMIN: Issue a New Loan ---
router.post(
  "/issue-loan",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    // console.log(req.body);

    try {
      const {
        accountNumber,
        loanType,
        baseAmount,
        interestRate,
        emisLeft, // This is the duration of the loan in months
      } = req.body;

      const principal = parseFloat(baseAmount);
      const rate = parseFloat(interestRate);
      const months = parseInt(emisLeft);

      if (principal < 1000)
        return res
          .status(400)
          .json({ message: "Minimum loan amount is ₹1000." });
      if (months <= 0)
        return res
          .status(400)
          .json({ message: "Loan duration must be at least 1 month." });

      const result = await sequelize.transaction(async (t) => {
        // 1. Verify the receiving account exists and is active
        const account = await Account.findOne({ where: { accountNumber } });
        if (!account) throw new Error(`Account ${accountNumber} not found.`);
        if (account.status !== "RUNNING")
          throw new Error("Cannot issue a loan to an inactive account.");

        // 2. Find Bank Master Account (where the money comes from)
        const bankUser = await User.findOne({
          where: { email: "bank@gmail.com" },
        });
        if (!bankUser) throw new Error("Bank system user not found.");
        const bankAccount = await Account.findOne({
          where: { userId: bankUser.id },
        });
        if (!bankAccount) throw new Error("Bank master account not found.");

        // 3. Do the Financial Math
        const emiAmount = calculateEMI(principal, rate, months);
        const uniqueLoanNumber = await generateUniqueLoanNumber();

        const today = new Date();
        const nextEmiDate = new Date(today);
        nextEmiDate.setMonth(today.getMonth() + 1); // First payment due in 1 month

        const deadlineDate = new Date(today);
        deadlineDate.setMonth(today.getMonth() + months); // Final payment due at the end of the term

        // 4. Create the Loan Record
        const newLoan = await Loan.create(
          {
            accountId: account.id,
            accountNumber: account.accountNumber,
            loanNumber: uniqueLoanNumber,
            loanType,
            baseAmount: principal,
            interestRate: rate,
            issuedDate: today,
            nextEmiAmount: emiAmount,
            nextEmiDate: nextEmiDate,
            emisLeft: months,
            deadlineDate: deadlineDate,
            status: "ACTIVE",
          },
          { transaction: t },
        );

        // 5. Disburse the Funds (Update Balances)
        account.balance = parseFloat(account.balance) + principal;
        await account.save({ transaction: t });

        bankAccount.balance = parseFloat(bankAccount.balance) - principal;
        await bankAccount.save({ transaction: t });

        // 6. Create Ledger Transactions
        // Bank sends the money out
        await Transaction.create(
          {
            accountId: bankAccount.id,
            type: "TRANSFER_OUT",
            amount: principal,
            balanceAfter: bankAccount.balance,
            senderAccountNumber: bankAccount.accountNumber,
            receiverAccountNumber: account.accountNumber,
            description: `Loan Disbursement: ${uniqueLoanNumber}`,
          },
          { transaction: t },
        );

        // User receives the money
        await Transaction.create(
          {
            accountId: account.id,
            type: "DEPOSIT", // Or "TRANSFER_IN"
            amount: principal,
            balanceAfter: account.balance,
            senderAccountNumber: bankAccount.accountNumber,
            receiverAccountNumber: account.accountNumber,
            description: `Loan Disbursement: ${uniqueLoanNumber}`,
          },
          { transaction: t },
        );

        return newLoan;
      });

      res.status(201).json({
        message: "Loan successfully issued and funds disbursed to user.",
        loan: result,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

module.exports = router;
