import { prisma } from "../config/database.js";
import { Role, ApprovalStatus } from "../generated/prisma/index.js";
// 5. Create Student Profile (Called after basic registration)
export const createStudentProfile = async (req, res) => {
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
        // Approve the user after profile creation
        await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: ApprovalStatus.APPROVED },
        });
        res.status(201).json({
            message: "Student profile created successfully. You can now login.",
            profile
        });
    }
    catch (error) {
        console.error("Create student profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 6. Get Student Profile
export const getStudentProfile = async (req, res) => {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: req.user.id },
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
    }
    catch (error) {
        console.error("Get student profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 7. Update Student Profile
export const updateStudentProfile = async (req, res) => {
    try {
        const { department, branch, semester, phoneNumber, address, guardianName, guardianPhone } = req.body;
        const profile = await prisma.studentProfile.update({
            where: { userId: req.user.id },
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
    }
    catch (error) {
        console.error("Update student profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
//# sourceMappingURL=studentController.js.map