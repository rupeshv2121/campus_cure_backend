import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma, JWT_SECRET } from "../config/database.js";
import { Role, ApprovalStatus } from "../generated/prisma/index.js";
// 1. Register (Student / Faculty / Admin)
export const register = async (req, res) => {
    try {
        const { name, email, password, role, username } = req.body;
        // Validate required fields
        if (!name || !email || !password || !role || !username) {
            res.status(400).json({ error: "All fields are required" });
            return;
        }
        // Validate role
        if (!["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"].includes(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });
        if (existingUser) {
            res.status(400).json({ error: "User with this email or username already exists" });
            return;
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                username,
                role: role,
                approvalStatus: ApprovalStatus.PENDING,
                isActive: false,
            },
        });
        res.status(201).json({
            message: "Registration successful. Waiting for approval.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
                approvalStatus: user.approvalStatus,
            },
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 2. Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            res.status(401).json({ error: "Invalid email" });
            return;
        }
        // Check approval status
        if (user.approvalStatus !== ApprovalStatus.APPROVED) {
            res.status(403).json({
                error: "Account not approved yet",
                approvalStatus: user.approvalStatus
            });
            return;
        }
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: "Invalid password" });
            return;
        }
        // Update user status to active
        await prisma.user.update({
            where: { id: user.id },
            data: { isActive: true },
        });
        // Update last login for admin
        if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
            await prisma.adminProfile.update({
                where: { userId: user.id },
                data: { lastLoginAt: new Date() },
            });
        }
        // Generate JWT token
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 3. Get Logged-In User (JWT based)
export const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                role: true,
                approvalStatus: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                studentProfile: true,
                facultyProfile: true,
                adminProfile: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 4. Logout
export const logout = async (req, res) => {
    try {
        // Update user status to inactive
        await prisma.user.update({
            where: { id: req.user.id },
            data: { isActive: false },
        });
        res.json({ message: "Logout successful" });
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
//# sourceMappingURL=authController.js.map