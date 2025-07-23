import { adminLogin, createAdmin, deleteAdminByUserName, getAdminUsernamesAndCommissions, getAllAdmins, updateAdminCommission } from '../controller/admins.controller.js';
import express from 'express'

const router = express.Router();

router.post('/create-admin', createAdmin);
router.get("/get-admins", getAllAdmins);
router.post("/login-admin", adminLogin);
router.post("/update-commission", updateAdminCommission);
router.get("/get-commission-details", getAdminUsernamesAndCommissions);
router.post("/delete-commission", deleteAdminByUserName);

export default router;