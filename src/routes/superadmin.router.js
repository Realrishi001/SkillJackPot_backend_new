import express from 'express'
import { superAdminLogin,createSuperAdmin,getAllSuperAdmins } from '../controller/superadmin.controller.js';

const router = express.Router();

router.post("/superadmin-login", superAdminLogin);
router.post("/create-superadmin", createSuperAdmin);
router.get("/superadmins", getAllSuperAdmins);

export default router;