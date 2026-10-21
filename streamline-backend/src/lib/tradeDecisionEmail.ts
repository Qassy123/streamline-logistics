import { prisma } from "./prisma";
import { departmentEmail, departmentSender, emailLayout } from "./email";
import { TRADE_PAYMENT_NOTICE, TRADE_PAYMENT_EXAMPLE } from "./billingPolicy";
function escape(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
export async function sendTradeDecisionEmail(id: string) {
  const mail = await prisma.tradeDecisionEmail.findUnique({ where: { id } });
  if (!mail || mail.sentAt) return { sent: true };
  try {
    if (!process.env.RESEND_API_KEY?.trim()) throw new Error("RESEND_API_KEY is not configured.");
    const approved = mail.decision === "APPROVED", subject = `Trade account ${approved ? "approved" : "application rejected"} - Streamline Logistics Group`;
    const body = approved ? `<p>Your application for a Streamline Logistics Group trade account has been approved.</p><p>${TRADE_PAYMENT_NOTICE}</p><p>${TRADE_PAYMENT_EXAMPLE}</p><p>You can log in to use your approved trade account.</p>` : `<p>Your application for a Streamline Logistics Group trade account has been rejected.</p><p>Reason: ${escape(mail.reason || "Please contact our team for details.")}</p><p>Contact us if you would like to discuss the decision.</p>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json", "Idempotency-Key": `trade-decision-${mail.id}` }, body: JSON.stringify({ from: departmentSender("accounts"), reply_to: departmentEmail("accounts"), to: [mail.recipient], subject, html: emailLayout(approved ? "Trade account approved" : "Trade account application rejected", `<p>Dear ${escape(mail.companyName)},</p>${body}`, "accounts") }) });
    const payload = await response.json() as { id?: string; message?: string };
    if (!response.ok) throw new Error(payload.message || "Email provider rejected the decision email.");
    await prisma.tradeDecisionEmail.update({ where: { id }, data: { sentAt: new Date(), providerMessageId: payload.id || null, attempts: { increment: 1 }, lastError: null } });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Decision email failed.";
    await prisma.tradeDecisionEmail.update({ where: { id }, data: { attempts: { increment: 1 }, lastError: message.slice(0, 1000) } });
    return { sent: false, error: message };
  }
}
export async function processTradeDecisionEmails() {
  const pending = await prisma.tradeDecisionEmail.findMany({ where: { sentAt: null }, orderBy: { createdAt: "asc" }, take: 25 });
  const results = [];
  for (const mail of pending) results.push({ id: mail.id, ...await sendTradeDecisionEmail(mail.id) });
  return results;
}
