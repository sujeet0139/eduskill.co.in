const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendWelcomeEmail(studentEmail, studentName, referenceNo) {
  try {
    const info = await transporter.sendMail({
      from: `"EduSkill" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: "Welcome to EduSkill - Registration Successful!",
      html: `
        <h2>Welcome to EduSkill, ${studentName}!</h2>
        <p>Your registration was successful.</p>
        <p>Your Reference Number is: <strong>${referenceNo}</strong></p>
        <p>Please use your Email and Reference Number to log in to your student dashboard.</p>
        <br/>
        <p>Best Regards,<br/>The EduSkill Team</p>
      `,
    });
    console.log("Welcome email sent successfully: %s", info.messageId);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}

module.exports = { sendWelcomeEmail };