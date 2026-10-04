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
import {
  authLimiter,
  emailLoginRequestLimiter,
  faceLoginLimiter,
} from "../middleware/rateLimit.js";
import {
  disableTwoFactor,
  enableTwoFactor,
  getLoginMethods,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  requestEmailLogin,
  setupTwoFactor,
  verifyEmailLogin,
  verifyTwoFactorLogin,
} from "../controllers/mfaController.js";

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

// CC-62: two-factor authentication. Management needs a session; the login
// step does not (it is the second half of getting one), so it is rate-limited
// on top of the per-challenge attempt cap.
router.get("/2fa", authenticate, getTwoFactorStatus);
router.post("/2fa/setup", authenticate, setupTwoFactor);
router.post("/2fa/enable", authenticate, enableTwoFactor);
router.post("/2fa/disable", authenticate, authLimiter, disableTwoFactor);
router.post("/2fa/recovery-codes", authenticate, regenerateRecoveryCodes);
router.post("/2fa/verify", authLimiter, verifyTwoFactorLogin);

// CC-63: sign in with a code sent by email instead of a password.
router.get("/methods", getLoginMethods);
router.post("/email-login/request", emailLoginRequestLimiter, requestEmailLogin);
router.post("/email-login/verify", authLimiter, verifyEmailLogin);

export default router;
