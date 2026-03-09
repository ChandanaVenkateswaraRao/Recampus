const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000
});

const sendEmail = async ({ to, subject, text, html }) => {

  try {

    const info = await transporter.sendMail({
      from: '"ReCampus Support" <noreply@recampus.app>',
      to,
      subject,
      text,
      html
    });

    console.log("Email sent:", info.messageId);

    return info;

  } catch (error) {

    console.error("Email sending error:", error);

    throw new Error("Failed to send email");

  }

};


transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server ready");
  }
});

module.exports = sendEmail;