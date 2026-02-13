import { Router } from "express";
import { register, login, getMe, logout } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// AUTH APIs
// 1. Register (Student / Faculty / Admin)
router.post("/register", register);

// 2. Login
router.post("/login", login);

// 3. Get Logged-In User (JWT based)
router.get("/me", authenticate, getMe);

// 4. Logout
router.post("/logout", authenticate, logout);

export default router;