import { sequelizeCon, DataTypes } from "../init/dbConnection.js";
import bcrypt from "bcryptjs";

const Admin = sequelizeCon.define(
  "admins",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gstNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    panNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contactPersonName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contactPersonPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contactPersonEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    openTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    closeTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,   // long text for address
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING, // STRING to allow formatted numbers
      allowNull: false,
    },
    emailAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    commission: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    hooks: {
      // Hash password before creating user
      beforeCreate: async (admin) => {
        if (admin.password) {
          const salt = await bcrypt.genSalt(10);
          admin.password = await bcrypt.hash(admin.password, salt);
        }
      },
      // Hash password before updating if it's changed
      beforeUpdate: async (admin) => {
        if (admin.changed("password")) {
          const salt = await bcrypt.genSalt(10);
          admin.password = await bcrypt.hash(admin.password, salt);
        }
      }
    }
  }
);

export default Admin;
