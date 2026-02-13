import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, ApprovalStatus, AdminLevel } from "./generated/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();
const PORT = 5000;
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-in-production";

// Middleware
app.use(cors());
app.use(express.json());

// TYPES & INTERFACES
interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    username: string;
  };
}

// MIDDLEWARE

// Authentication Middleware
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: Role; username: string };
    
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Role-based Authorization Middleware
const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    next();
  };
};

// AUTH APIs
// 1. Register (Student / Faculty / Admin)
app.post("/api/auth/register", async (req: Request, res: Response): Promise<void> => {
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
        role: role as Role,
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
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Login
app.post("/api/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid username" });
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
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Get Logged-In User (JWT based)
app.get("/api/auth/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 4. Logout
app.post("/api/auth/logout", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Update user status to inactive
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isActive: false },
    });

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================
// STUDENT PROFILE APIs
// ======================

// 5. Create Student Profile (Called after basic registration)
app.post("/api/students", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, enrollmentNumber, department, branch, semester, phoneNumber, address, guardianName, guardianPhone } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.STUDENT) {
      res.status(400).json({ error: "User is not a student" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Student profile already exists" });
      return;
    }

    const profile = await prisma.studentProfile.create({
      data: {
        userId,
        enrollmentNumber: enrollmentNumber || user.username,
        department: department || "",
        branch: branch || "",
        semester: semester || 1,
        phoneNumber: phoneNumber || 0,
        address: address || "",
        isStudying: req.body.isStudying !== undefined ? req.body.isStudying : true,
        guardianName: guardianName || "",
        guardianPhone: guardianPhone || "",
        doubtsAsked: 0,
        doubtsSolved: 0,
      },
    });


    res.status(201).json({ 
      message: "Student profile created successfully",
      profile 
    });
  } catch (error) {
    console.error("Create student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 6. Get Student Profile 
app.get("/api/students/me", authenticate, authorize(Role.STUDENT), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 7. Update Student Profile
app.put("/api/students/me", authenticate, authorize(Role.STUDENT), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department, branch, semester, phoneNumber, address, guardianName, guardianPhone } = req.body;

    const profile = await prisma.studentProfile.update({
      where: { userId: req.user!.id },
      data: {
        ...(department && { department }),
        ...(branch && { branch }),
        ...(semester && { semester }),
        ...(phoneNumber && { phoneNumber }),
        ...(address && { address }),
        ...(guardianName && { guardianName }),
        ...(guardianPhone && { guardianPhone }),
      },
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    console.error("Update student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================
// FACULTY PROFILE APIs
// ======================

// 8. Create Faculty Profile
app.post("/api/faculty", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, department, branch, phoneNumber, address, subjects } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.FACULTY) {
      res.status(400).json({ error: "User is not faculty" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.facultyProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Faculty profile already exists" });
      return;
    }

    const profile = await prisma.facultyProfile.create({
      data: {
        userId,
        department: department || "",
        branch: branch || "",
        phoneNumber: phoneNumber || "",
        address: address || "",
        isTeaching: req.body.isTeaching !== undefined ? req.body.isTeaching : true,
        subjects: subjects || [],
        doubtsSolved: 0,
      },
    });

    res.status(201).json({ 
      message: "Faculty profile created successfully",
      profile 
    });
  } catch (error) {
    console.error("Create faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 9. Get Faculty Profile
app.get("/api/faculty/me", authenticate, authorize(Role.FACULTY), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Faculty profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 10. Update Faculty Profile
app.put("/api/faculty/me", authenticate, authorize(Role.FACULTY), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department, branch, phoneNumber, address, subjects, isTeaching } = req.body;

    const profile = await prisma.facultyProfile.update({
      where: { userId: req.user!.id },
      data: {
        ...(department && { department }),
        ...(branch && { branch }),
        ...(phoneNumber && { phoneNumber }),
        ...(address && { address }),
        ...(subjects && { subjects }),
        ...(isTeaching !== undefined && { isTeaching }),
      },
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    console.error("Update faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================
// ADMIN & SUPER ADMIN APIs
// ======================

// 11. Get Pending Students (Admin)
app.get("/api/admin/pending/students", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingStudents = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        studentProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingStudents });
  } catch (error) {
    console.error("Get pending students error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 12. Get Pending Faculty (Admin)
app.get("/api/admin/pending/faculty", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingFaculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        facultyProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingFaculty });
  } catch (error) {
    console.error("Get pending faculty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 13. Create Admin Profile  (Super Admin)
app.post("/api/super-admin/admin", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, adminLevel, manageUsers, manageComplaints, viewAnalytics, assignedDepartments, allowedCategories } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      res.status(400).json({ error: "User is not an admin or super admin" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.adminProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Admin profile already exists" });
      return;
    }

    const profile = await prisma.adminProfile.create({
      data: {
        userId,
        adminLevel: adminLevel || AdminLevel.NORMAL,
        manageUsers: manageUsers !== undefined ? manageUsers : true,
        manageComplaints: manageComplaints !== undefined ? manageComplaints : true,
        viewAnalytics: viewAnalytics !== undefined ? viewAnalytics : true,
        assignedDepartments: assignedDepartments || [],
        allowedCategories: allowedCategories || [],
        complaintsAssigned: 0,
        complaintsClosed: 0,
        usersManaged: req.body.usersManaged || 0,
      },
    });

    res.status(201).json({ 
      message: "Admin profile created successfully.",
      profile 
    });
  } catch (error) {
    console.error("Create admin profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 14. Get Pending Admins (Super Admin)
app.get("/api/super-admin/pending/admins", authenticate, authorize(Role.SUPER_ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingAdmins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        adminProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingAdmins });
  } catch (error) {
    console.error("Get pending admins error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 15. Approve User
app.put("/api/admin/approve/:userId", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const userToApprove = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToApprove) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can approve Student/Faculty, Super Admin can approve Admin
    if (req.user!.role === Role.ADMIN && userToApprove.role === Role.ADMIN) {
      res.status(403).json({ error: "Only Super Admin can approve Admin users" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    res.json({ message: "User approved successfully", user: updatedUser });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 16. Reject User
app.put("/api/admin/reject/:userId", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const userToReject = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToReject) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can reject Student/Faculty, Super Admin can reject Admin
    if (req.user!.role === Role.ADMIN && userToReject.role === Role.ADMIN) {
      res.status(403).json({ error: "Only Super Admin can reject Admin users" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.REJECTED },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    res.json({ message: "User rejected successfully", user: updatedUser });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================
// SERVER STARTUP
// ======================

const start = async () => {
  try {
    await prisma.$connect();

    app.get("/", (req, res) => {
      res.send("Hello from TypeScript backend 🚀");
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
};

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
