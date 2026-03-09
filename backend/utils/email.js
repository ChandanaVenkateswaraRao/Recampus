const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS
  }
});

const sendEmail = async ({ to, subject, text, html }) => {
  try {

    const mailOptions = {
      from: '"ReCampus Support" <noreply@recampus.app>',
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId);

    return info;

  } catch (error) {

    console.error("Email sending error:", error);

    throw new Error("Failed to send email");

  }
};

module.exports = sendEmail;


