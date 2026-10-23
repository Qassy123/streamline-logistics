import crypto from "crypto";
import { prisma } from "./prisma";
import { sendEmail, emailLayout } from "./email";
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
export async function sendCustomerPasswordInvite(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.accountStatus !== "ACTIVE")
        return { sent: false, error: "An active customer account is required." };
    if (!process.env.RESEND_API_KEY)
        return { sent: false, error: "Email delivery is not configured. Configure the email sender, then resend the password setup link." };
    let resetId: string | undefined;
    try {
        const token = crypto.randomBytes(32).toString("hex");
        const url = new URL("/account-recovery?kind=customer&purpose=setup", process.env.FRONTEND_URL || "https://streamlinelogisticsgroup.co.uk");
        if (!["https:", "http:"].includes(url.protocol))
            throw new Error("Invalid frontend URL");
        url.hash = token;
        const row = await prisma.accountRecoveryToken.create({ data: { kind: "customer", subjectId: user.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 24 * 3600000) } });
        resetId = row.id;
        const result = await sendEmail({ to: user.email, department: "support", subject: "Set your Streamline account password", html: emailLayout("Set your account password", `<p>Hello ${escape(user.name)},</p><p>Your Streamline customer account is ready. Use your account email ${escape(user.email)} and choose your own password using the secure link below.</p><p><a href="${escape(url.toString())}">Set your password</a></p><p>This link expires in 24 hours and can be used once. If you were not expecting this account, contact our team.</p>`, "support") });
        if (("skipped" in result && result.skipped) || ("error" in result && result.error))
            throw new Error("Delivery failed");
        await prisma.auditLog.create({ data: { action: "CUSTOMER_PASSWORD_INVITE_SENT", entityType: "User", entityId: user.id, reason: "Password setup link sent to the customer's registered account email." } }).catch(() => { console.error("Customer password invitation audit could not be stored."); });
        return { sent: true };
    }
    catch {
        if (resetId)
            await prisma.accountRecoveryToken.update({ where: { id: resetId }, data: { usedAt: new Date() } });
        return { sent: false, error: "The account is saved, but the password setup email could not be delivered. Resend the link from the customer profile." };
    }
}
