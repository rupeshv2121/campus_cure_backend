import { Router } from "express";
import {
  deleteFaceDescriptor,
  faceVerify,
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

// 6. Face verification - CC-60.
//
// `POST /face-login` is GONE. It was unauthenticated, matched 1:N across every
// enrolled user, and issued a full session to the nearest match. This replaces
// it: reachable only with a challenge that the password step issued, matched
// 1:1 against that one account.
router.post("/face/verify", faceLoginLimiter, faceVerify);

// 6b. Un-enrol. The escape hatch for a user who can no longer present the
// face they enrolled - see the spec's lockout section.
router.delete("/face-descriptor", authenticate, deleteFaceDescriptor);

export default router;
