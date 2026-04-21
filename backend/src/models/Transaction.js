const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Transaction = sequelize.define(
  "Transaction",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Accounts",
        key: "id",
      },
      comment: "The account this specific ledger line belongs to",
    },
    type: {
      type: DataTypes.ENUM(
        "DEPOSIT",
        "WITHDRAWAL",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    // --- NEW: FROM AND TO FIELDS ---
    senderAccountNumber: {
      type: DataTypes.STRING,
      allowNull: true, // Null if it's just a cash deposit
      comment: "The account sending the money (FROM)",
    },
    receiverAccountNumber: {
      type: DataTypes.STRING,
      allowNull: true, // Null if it's just a cash withdrawal
      comment: "The account receiving the money (TO)",
    },
    // -------------------------------
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    referenceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    updatedAt: false, // We keep createdAt (which holds your exact Date and Time), but disable updatedAt
  },
);

module.exports = Transaction;
