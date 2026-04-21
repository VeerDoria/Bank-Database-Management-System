const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Loan = sequelize.define(
  "Loan",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // The strict database link to the Account table
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Accounts",
        key: "id",
      },
    },
    // The visual 12-digit account number (matches your requirements)
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // A uniquely generated number specifically for this loan
    loanNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    loanType: {
      type: DataTypes.ENUM("HOME", "CAR", "PERSONAL", "EDUCATION", "BUSINESS"),
      allowNull: false,
    },
    baseAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 1000, // Minimum loan amount rule
      },
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2), // e.g., 8.50%
      allowNull: false,
    },
    issuedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true, // Null until the admin actually approves/issues it
    },
    nextEmiAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nextEmiDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    emisLeft: {
      type: DataTypes.INTEGER, // Number of months/payments remaining
      allowNull: false,
    },
    deadlineDate: {
      type: DataTypes.DATEONLY, // When the absolute final payment is due
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "ACTIVE", "CLOSED", "DEFAULTED","REJECTED"),
      defaultValue: "PENDING",
    },
  },
  {
    timestamps: true, // Keeps createdAt and updatedAt for auditing
  },
);

module.exports = Loan;
