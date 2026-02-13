import { prisma } from "../config/database.js";
import { Role, ApprovalStatus, AdminLevel } from "../generated/prisma/index.js";
// 11. Get Pending Students (Admin)
export const getPendingStudents = async (req, res) => {
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
    }
    catch (error) {
        console.error("Get pending students error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 12. Get Pending Faculty (Admin)
export const getPendingFaculty = async (req, res) => {
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
    }
    catch (error) {
        console.error("Get pending faculty error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 13. Create Admin Profile
export const createAdminProfile = async (req, res) => {
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
        // Approve the user after profile creation
        await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: ApprovalStatus.APPROVED },
        });
        res.status(201).json({
            message: "Admin profile created successfully. You can now login.",
            profile
        });
    }
    catch (error) {
        console.error("Create admin profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 14. Get Pending Admins (Super Admin)
export const getPendingAdmins = async (req, res) => {
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
    }
    catch (error) {
        console.error("Get pending admins error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 15. Approve User
export const approveUser = async (req, res) => {
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
        if (req.user.role === Role.ADMIN && userToApprove.role === Role.ADMIN) {
            res.status(403).json({ error: "Only Super Admin can approve Admin users" });
            return;
        }
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: ApprovalStatus.APPROVED },
        });
        // Update admin stats
        if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) {
            await prisma.adminProfile.update({
                where: { userId: req.user.id },
                data: {
                    usersManaged: { increment: 1 },
                },
            });
        }
        res.json({ message: "User approved successfully", user: updatedUser });
    }
    catch (error) {
        console.error("Approve user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 16. Reject User
export const rejectUser = async (req, res) => {
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
        if (req.user.role === Role.ADMIN && userToReject.role === Role.ADMIN) {
            res.status(403).json({ error: "Only Super Admin can reject Admin users" });
            return;
        }
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: ApprovalStatus.REJECTED },
        });
        // Update admin stats
        if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) {
            await prisma.adminProfile.update({
                where: { userId: req.user.id },
                data: {
                    usersManaged: { increment: 1 },
                },
            });
        }
        res.json({ message: "User rejected successfully", user: updatedUser });
    }
    catch (error) {
        console.error("Reject user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
//# sourceMappingURL=adminController.js.map