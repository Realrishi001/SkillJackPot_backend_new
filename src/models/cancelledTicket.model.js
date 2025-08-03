import { sequelizeCon, DataTypes } from "../init/dbConnection.js";

const cancelledTickets = sequelizeCon.define(
    "cancelledTickets",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        }, 
        gameTime : {
            type: DataTypes.STRING,
            allowNull: false,
        },
        loginId : {
            type : DataTypes.STRING,
            allowNull: false,
        },
        ticketNumber : {
            type : DataTypes.JSON,
            allowNull : false,
        },
        totalQuatity : {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        totalPoints : {
            type : DataTypes.STRING,
            allowNull : false
        },
        drawTime : {
            type : DataTypes.JSON,
            allowNull : false,
        }
    },{
        timestamps : true
    }
)

export {cancelledTickets};