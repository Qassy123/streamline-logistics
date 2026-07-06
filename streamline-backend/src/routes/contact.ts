import { Router } from "express";
import { Resend } from "resend";

const router = Router();

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      pickup,
      delivery,
      message,
    } = req.body;

    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: "info@streamlinelogisticsgroup.co.uk",
      replyTo: email,
      subject: `New enquiry from ${name}`,
      html: `
        <h2>New Website Enquiry</h2>

        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Service:</strong> ${service || "Not provided"}</p>
        <p><strong>Pickup:</strong> ${pickup || "Not provided"}</p>
        <p><strong>Delivery:</strong> ${delivery || "Not provided"}</p>

        <h3>Message</h3>

        <p>${message}</p>
      `,
    });

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
      });
    }

    res.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;