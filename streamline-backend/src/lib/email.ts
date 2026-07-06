import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing. Email skipped:", subject);
    return { skipped: true };
  }

  const from =
    process.env.EMAIL_FROM ||
    "Streamline Logistics Group <info@streamlinelogisticsgroup.co.uk>";

  return resend.emails.send({
    from,
    to,
    subject,
    html,
    replyTo,
  });
}

export function emailLayout(title: string, content: string) {
  return `
    <div style="font-family: Arial, sans-serif; background:#f6f7f9; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; padding:28px; border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px; color:#111827;">${title}</h1>
        <div style="font-size:15px; color:#374151; line-height:1.6;">
          ${content}
        </div>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
        <p style="font-size:13px; color:#6b7280;">
          Streamline Logistics Group<br/>
          ${process.env.FRONTEND_URL || "https://streamlinelogisticsgroup.co.uk"}
        </p>
      </div>
    </div>
  `;
}