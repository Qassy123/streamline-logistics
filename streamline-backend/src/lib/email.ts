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
  const frontendUrl =
    process.env.FRONTEND_URL || "https://streamlinelogisticsgroup.co.uk";

  const logoUrl = `${frontendUrl}/email-logo.png`;

  return `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#071D49;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:28px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #d7e6ff;box-shadow:0 10px 30px rgba(7,29,73,0.12);">
              
              <tr>
                <td style="background:#020B1F;padding:28px 28px 24px;text-align:center;">
                  <img src="${logoUrl}" alt="Streamline Logistics Group" style="max-width:360px;width:100%;height:auto;display:block;margin:0 auto;" />
                </td>
              </tr>

              <tr>
                <td style="padding:34px 30px 20px;">
                  <h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#071D49;font-weight:800;">
                    ${title}
                  </h1>

                  <div style="font-size:15px;line-height:1.7;color:#24324b;">
                    ${content}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 30px 28px;">
                  <div style="background:#f4f8ff;border:1px solid #d7e6ff;border-radius:14px;padding:18px;">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#24324b;">
                      Need help? Contact us at
                      <a href="mailto:info@streamlinelogisticsgroup.co.uk" style="color:#006CFF;font-weight:700;text-decoration:none;">
                        info@streamlinelogisticsgroup.co.uk
                      </a>
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background:#020B1F;padding:22px 30px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:13px;color:#ffffff;font-weight:700;">
                    Fast. Reliable. Dependable.
                  </p>
                  <p style="margin:0;font-size:12px;color:#9fb7d9;">
                    Streamline Logistics Group ·
                    <a href="${frontendUrl}" style="color:#2D8CFF;text-decoration:none;">
                      ${frontendUrl.replace("https://", "")}
                    </a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}