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

// 5. Save Face Descriptor (requires JWT — called right after registration)
router.post("/save-face-descriptor", authenticate, saveFaceDescriptor);

// 6. Face Login
router.post("/face-login", faceLogin);

export default router;
