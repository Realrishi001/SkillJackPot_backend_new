import { sequelizeCon, DataTypes } from "../init/dbConnection.js";
import bcrypt from "bcryptjs";

const superAdmin = sequelizeCon.define(
    "superAdmins",
    {
        id: {
            type : DataTypes.INTEGER,
            primaryKey : true,
            autoIncrement : true,
        },
        fullName : {
            type: DataTypes.STRING,
            allowNull : false
        },
        userName: {
            type : DataTypes.STRING,
            allowNull: false
        },
        address : {
            type : DataTypes.TEXT,
            allowNull : false
        },
        phoneNumber : {
            type : DataTypes.STRING,
            allowNull : false
        },
        emailAddress : {
            type : DataTypes.STRING,
            allowNull : false
        },
        password : {
            type : DataTypes.STRING,
            allowNull: false,
        }
    },{
        timestamps : true,
        hooks : {
            beforeCreate : async (superAdmin) => {
                if(superAdmin.changed("password")) {
                    const salt = await bcrypt.genSalt(10);
                    superAdmin.password = await bcrypt.hash(superAdmin.password, salt);
                }
            }
        }
    }
);

export default superAdmin;