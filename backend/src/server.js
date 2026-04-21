require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");

// Route Imports
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const transactionRoutes = require("./routes/transaction");
const adminRoutes = require("./routes/admin");
const loanRoutes = require("./routes/loan");

// Middleware
const { authenticateToken, authorizeRoles } = require("./middleware/auth");


// Models & Relationships
const User = require("./models/User");
const Account = require("./models/Account");
const Transaction = require("./models/Transaction");

const Loan = require('./models/Loan'); // Make sure to import it at the top!

// --- Define Relationships ---
Account.hasMany(Loan, { foreignKey: 'accountId', as: 'loans' });
Loan.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

// (Optional) Link the loan directly to the user so you can fetch a user's total debt easily
// User.hasMany(Loan, { foreignKey: 'userId', as: 'loans' }); // Make sure to add userId to the Loan model if you want this!

// Define Relationships here before syncing
// --- Define Relationships here before syncing ---

User.hasMany(Account, { foreignKey: "userId", as: "accounts" });
Account.belongsTo(User, { foreignKey: "userId", as: "user" });

// 1. The primary relationship linking a ledger row to its owner's account
// FIXED TYPO HERE: foreignKey is "accountId"
Account.hasMany(Transaction, { foreignKey: "accountId", as: "transactions" });
Transaction.belongsTo(Account, { foreignKey: "accountId", as: "account" });

// 2. Link the sender's account number to the Account table
Transaction.belongsTo(Account, {
  foreignKey: "senderAccountNumber",
  targetKey: "accountNumber", // Joins on the 12-digit number instead of the UUID
  as: "sender",
});

// 3. Link the receiver's account number to the Account table
Transaction.belongsTo(Account, {
  foreignKey: "receiverAccountNumber",
  targetKey: "accountNumber", // Joins on the 12-digit number instead of the UUID
  as: "receiver",
});
const app = express();

// --- Middleware Setup ---
app.use(
  cors({
    origin: "http://localhost:5173", // Make sure this matches your Vite frontend URL!
    credentials: true,
  }),
);

app.use(express.json());

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/loans", loanRoutes);

// --- Protected Admin Route (Updated) ---
app.get(
  "/api/admin-dashboard", // Renamed for clarity
  authenticateToken,
  authorizeRoles("ADMIN"), // Removed "EMPLOYEE"
  (req, res) => {
    res.json({ message: "Welcome to the secure Admin dashboard." });
  },
);

// --- Database Sync & Server Start ---
const PORT = process.env.PORT || 3000;

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("MySQL Database connected and synced");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Error connecting to database:", err));
