const axios = require("axios");

const sendEmail = async ({ to, subject, text, html }) => {
  try {

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "ReCampus Support",
          email: "noreply@recampus.app"
        },
        to: [
          {
            email: to
          }
        ],
        subject: subject,
        textContent: text,
        htmlContent: html
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Email sent successfully:", response.data);

    return response.data;

  } catch (error) {

    console.error("Email sending error:", error.response?.data || error.message);

    throw new Error("Failed to send email");

  }
};

module.exports = sendEmail;