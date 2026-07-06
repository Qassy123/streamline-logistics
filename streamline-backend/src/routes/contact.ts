import { Router } from "express";
import { emailLayout, sendEmail } from "../lib/email";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, service, pickup, delivery, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required.",
      });
    }

    await sendEmail({
      to: "info@streamlinelogisticsgroup.co.uk",
      replyTo: email,
      subject: `New enquiry from ${name}`,
      html: emailLayout(
        "New Website Enquiry",
        `
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Service:</strong> ${service || "Not provided"}</p>
          <p><strong>Pickup:</strong> ${pickup || "Not provided"}</p>
          <p><strong>Delivery:</strong> ${delivery || "Not provided"}</p>
          <h3>Message</h3>
          <p>${message}</p>
        `,
      ),
    });

    await sendEmail({
      to: email,
      subject: "We've received your enquiry",
      html: emailLayout(
        "We've received your enquiry",
        `
          <p>Hi ${name},</p>
          <p>Thanks for contacting Streamline Logistics Group.</p>
          <p>We've received your enquiry and one of our team will contact you shortly.</p>
          <p><strong>Your enquiry details:</strong></p>
          <p>
            Service: ${service || "Not provided"}<br/>
            Pickup: ${pickup || "Not provided"}<br/>
            Delivery: ${delivery || "Not provided"}
          </p>
          <p>Kind regards,<br/>Streamline Logistics Group</p>
        `,
      ),
    });

    res.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error("Contact email error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;