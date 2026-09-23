/**
 * Staff directory (CC-27).
 *
 * Its own router, mounted outside /api/faculty, because the directory is for
 * EVERY authenticated role — the point is that a student with a flooded
 * bathroom can find the plumber. Mounting it under /faculty would have put a
 * `authorize(Role.FACULTY)` guard next to it sooner or later.
 *
 * Authenticated, though: the roadmap cut a student directory as a harassment
 * vector, and an unauthenticated staff directory is a scraper's list of names,
 * roles and phone numbers for one institution.
 */
import { Router } from "express";
import { getStaffDirectory } from "../controllers/facultyController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/directory", authenticate, getStaffDirectory);

export default router;
