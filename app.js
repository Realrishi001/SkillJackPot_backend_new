import express from 'express'
import dotenv from 'dotenv';
import cors from 'cors'
import { sequelizeCon } from './src/init/dbConnection.js'; 

// file imports
import printdTicekts from './src/routes/printedTickets.rotuer.js'
import admins from './src/routes/admins.router.js'
import winningPercentage from './src/routes/winningPercentage.routes.js'
import winnings from './src/routes/getWinningNumbers.router.js'
import dashboard from './src/routes/admindashboard.router.js'
import drawRouter from './src/routes/drawloadpoint.router.js'
import summaryRouter from './src/routes/summary.router.js'
import navbarRouter from './src/routes/navbar.router.js'

dotenv.config;


sequelizeCon.sync({force : false})
.then(()=>{
    console.log('Database synced successfully');
})
.catch((err)=> {
    console.error("Error syncing database", err);
});

const app = express();
const port = process.env.PORT || 3085;
const corsOptions = {
    origin : '*',
    methods : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders : ['Content-Type', 'Authorization'],
    credentials : true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.status(200).json({
        message : "Hello, developer. You've reached the API. It's been waiting.",
        status : "online-ish",
        warnings : [
            "Payment Bacha hai abhi"
        ],
        tip : "Payment pura kardo jaldi"
    });
});


app.use("/api", printdTicekts);
app.use("/api", admins);
app.use("/api", winningPercentage);
app.use("/api", winnings);
app.use('/api', dashboard);
app.use("/api", drawRouter);
app.use("/api", summaryRouter);
app.use('/api', navbarRouter);

// Start the server
app.listen(port, ()=> {
    console.log(`Server is running on port ${port}`);
})