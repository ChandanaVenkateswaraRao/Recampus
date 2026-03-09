const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("EMAIL_USER or EMAIL_PASS not set in environment variables");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async ({ to, subject, text, html }) => {
  try {

    if (!to) throw new Error("Recipient email is required");
    if (!subject) throw new Error("Email subject is required");
    if (!text && !html) throw new Error("Email must contain text or html");

    const mailOptions = {
      from: `"ReCampus Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${to}`);
    console.log("Message ID:", info.messageId);

    return info;

  } catch (error) {

    console.error("Email sending error:", error);
    throw new Error("Failed to send email");

  }
};

module.exports = sendEmail;