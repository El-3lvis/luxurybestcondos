// Simple Express server to send contact form emails via Nodemailer
// Requires environment variables configured (see .env.example)

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:8081"],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com"; // hotmail/outlook
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = SMTP_PORT === 465; // true for 465, false for other ports
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const TARGET_EMAIL = process.env.TARGET_EMAIL || "Elvis-mujica@hotmail.com";

let transporter;

function createTransport() {
  if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    transporter.verify((error) => {
      if (error) {
        console.warn("[WARN] SMTP transport not verified:", error.message);
      } else {
        console.log("[OK] SMTP transport is ready to send emails");
      }
    });
    return;
  }

  console.warn(
    "[WARN] SMTP credentials missing. Creating Ethereal test account for preview only."
  );
  nodemailer
    .createTestAccount()
    .then((account) => {
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });
      console.log(
        "[OK] Ethereal test SMTP ready. Emails will NOT reach real inbox. Preview URL will be available."
      );
    })
    .catch((err) => {
      console.error("[ERROR] Failed to create Ethereal account:", err.message);
    });
}

createTransport();

app.post("/api/contact", async (req, res) => {
  const { name, propertyId, contactMethod, email, phone, message } = req.body || {};

  if (!name) {
    return res.status(400).json({ ok: false, error: "Missing name" });
  }

  const lines = [
    `Name: ${name}`,
    propertyId ? `Property ID: ${propertyId}` : null,
    contactMethod ? `Preferred contact: ${contactMethod}` : null,
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
    message ? `Message: ${message}` : null,
  ].filter(Boolean);

  const textBody = lines.join("\n");
  const htmlBody = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.6">
    <h2 style="margin:0 0 8px">New contact from website</h2>
    <p style="margin:0 0 12px">You received a new contact submission:</p>
    <ul>
      ${lines.map((l) => `<li>${l}</li>`).join("")}
    </ul>
  </div>`;

  try {
    if (!transporter) {
      return res.status(503).json({ ok: false, error: "Email transport not ready. Try again in a few seconds." });
    }

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: TARGET_EMAIL,
      subject: `New contact - ${name}`,
      text: textBody,
      html: htmlBody,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    return res.status(200).json({ ok: true, messageId: info.messageId, previewUrl });
  } catch (err) {
    console.error("[ERROR] Failed to send email:", err.message);
    return res.status(500).json({ ok: false, error: err.message || "Failed to send" });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Contact email server listening on http://localhost:${PORT}`);
});