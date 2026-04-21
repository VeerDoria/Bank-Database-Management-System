const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('ADMIN', 'CUSTOMER'),
        defaultValue: 'CUSTOMER'
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mobileNumber: {
        type: DataTypes.STRING,
        allowNull: true
    }, // Added missing comma here
    dob: { // Added missing colon
        type: DataTypes.DATEONLY, // DATEONLY is best for DOB as it ignores time
        allowNull: true
    }, // Added missing comma here
    gender: { // Added missing colon
        type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'),
        allowNull: true
    }
}, {
    hooks: {
        // Hash the password before saving if it has been changed
        beforeSave: async (user) => {
            if (user.changed('password') && user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Helper method to check passwords directly on the instance
User.prototype.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;