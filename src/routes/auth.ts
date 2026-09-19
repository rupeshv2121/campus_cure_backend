import { Router } from "express";
import {
  faceLogin,
  getMe,
  login,
  logout,
  register,
  saveFaceDescriptor,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter, faceLoginLimiter } from "../middleware/rateLimit.js";

const router = Router();

// AUTH APIs
// 1. Register (Student / Faculty / Admin)
router.post("/register", authLimiter, register);

// 2. Login
router.post("/login", authLimiter, login);

// 3. Get Logged-In User (JWT based)
router.get("/me", authenticate, getMe);

// 4. Logout
router.post("/logout", authenticate, logout);

// 5. Save Face Descriptor (requires JWT — called right after registration)
router.post("/save-face-descriptor", authenticate, saveFaceDescriptor);

// 6. Face Login
router.post("/face-login", faceLoginLimiter, faceLogin);

export default router;
