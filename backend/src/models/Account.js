const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Account = sequelize.define('Account', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users', // Make sure this matches your User table name
            key: 'id'
        }
    },
    accountNumber: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true // Nullable initially because it's only generated upon Admin approval
    },
    accountType: {
        type: DataTypes.ENUM('SAVINGS', 'CURRENT'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'RUNNING', 'CLOSED'),
        defaultValue: 'PENDING'
    },
    balance: {
        type: DataTypes.DECIMAL(15, 2), // Supports large numbers with 2 decimal places
        defaultValue: 0.00
    },
    interestRate: {
        type: DataTypes.DECIMAL(5, 2), // e.g., 4.50%
        allowNull: true
    },
    openingDate: {
        type: DataTypes.DATEONLY,
        allowNull: true // Set only when approved
    },
    openingFeePaid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = Account;