import { Router } from "express";
import {
  faceLogin,
  getMe,
  login,
  logout,
  refresh,
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
//
// Deliberately NOT behind `authenticate`: an expired access token is exactly
// when logout still needs to work. The refresh token in the body is what ends
// the session, and revoking it requires possessing it.
router.post("/logout", logout);

// 7. Refresh (CC-01b). Rate limited with the other credential endpoints —
// a refresh token is a credential.
router.post("/refresh", authLimiter, refresh);

// 5. Save Face Descriptor (requires JWT — called right after registration)
router.post("/save-face-descriptor", authenticate, saveFaceDescriptor);

// 6. Face Login
router.post("/face-login", faceLoginLimiter, faceLogin);

export default router;
