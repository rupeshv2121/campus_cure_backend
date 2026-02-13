import { prisma } from "../config/database.js";
import { Role, ApprovalStatus } from "../generated/prisma/index.js";
// 8. Create Faculty Profile
export const createFacultyProfile = async (req, res) => {
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
        // Approve the user after profile creation
        await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: ApprovalStatus.APPROVED },
        });
        res.status(201).json({
            message: "Faculty profile created successfully. You can now login.",
            profile
        });
    }
    catch (error) {
        console.error("Create faculty profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 9. Get Faculty Profile
export const getFacultyProfile = async (req, res) => {
    try {
        const profile = await prisma.facultyProfile.findUnique({
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
            res.status(404).json({ error: "Faculty profile not found" });
            return;
        }
        res.json({ profile });
    }
    catch (error) {
        console.error("Get faculty profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// 10. Update Faculty Profile
export const updateFacultyProfile = async (req, res) => {
    try {
        const { department, branch, phoneNumber, address, subjects, isTeaching } = req.body;
        const profile = await prisma.facultyProfile.update({
            where: { userId: req.user.id },
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
    }
    catch (error) {
        console.error("Update faculty profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
//# sourceMappingURL=facultyController.js.map