const nodemailer = require('nodemailer');

// Ensure environment variables exist
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("EMAIL_USER or EMAIL_PASS not set in environment variables");
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send Email Function
const sendEmail = async ({ to, subject, text, html }) => {
  try {

    if (!to) {
      throw new Error("Recipient email (to) is required");
    }

    if (!subject) {
      throw new Error("Email subject is required");
    }

    if (!text && !html) {
      throw new Error("Email must contain text or html content");
    }

    const mailOptions = {
      from: `"ReCampus Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${to}`);
    console.log("Message ID:", info.messageId);

    return info;

  } catch (error) {

    console.error("Email sending error:", error.message);
    throw new Error("Failed to send email");

  }
};

module.exports = sendEmail;