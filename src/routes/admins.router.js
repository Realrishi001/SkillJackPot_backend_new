import { addAdminBalance, adminLogin, createAdmin, deleteAdminByUserName, getAdminDetails, getAdminUsernamesAndBalance, getAdminUsernamesAndCommissions, getAllAdmins, mainAdminLogin, updateAdminCommission } from '../controller/admins.controller.js';
import express from 'express'

const router = express.Router();

router.post('/create-admin', createAdmin);
router.get("/get-admins", getAllAdmins);
router.post("/login-admin", adminLogin);
router.post("/update-commission", updateAdminCommission);
router.get("/get-commission-details", getAdminUsernamesAndCommissions);
router.post("/delete-commission", deleteAdminByUserName);
router.post("/main-admin-login", mainAdminLogin);
router.post("/update-balance", addAdminBalance);
router.get("/get-balance", getAdminUsernamesAndBalance);
router.get("/shop-report", getAdminDetails);

export default router;