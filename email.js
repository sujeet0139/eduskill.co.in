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

async function sendClassReminderEmail(studentEmail, studentName, classDetails) {
  try {
    const scheduledTime = new Date(classDetails.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const info = await transporter.sendMail({
      from: `"EduSkill" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: `Class Reminder: ${classDetails.title}`,
      html: `
        <h2>Hi ${studentName},</h2>
        <p>This is a reminder for your upcoming live class.</p>
        <p><strong>Class:</strong> ${classDetails.title}</p>
        <p><strong>Topic:</strong> ${classDetails.topic || 'N/A'}</p>
        <p><strong>Scheduled for:</strong> ${scheduledTime}</p>
        <p><strong>Meeting Link:</strong> <a href="${classDetails.meet_link}">${classDetails.meet_link}</a></p>
        <br/>
        <p>Please be ready to join on time.</p>
        <p>Best Regards,<br/>The EduSkill Team</p>
      `,
    });
    console.log(`Class reminder email sent to ${studentEmail}: %s`, info.messageId);
  } catch (error) {
    console.error(`Error sending class reminder to ${studentEmail}:`, error);
  }
}

async function sendClassMaterialsEmail(studentEmail, studentName, classDetails) {
  try {
    const info = await transporter.sendMail({
      from: `"EduSkill" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: `Recording & Materials for: ${classDetails.title}`,
      html: `
        <h2>Hi ${studentName},</h2>
        <p>The recording and materials for the class "<strong>${classDetails.title}</strong>" are now available.</p>
        ${classDetails.recording_url ? `<p><strong>Watch Recording:</strong> <a href="${classDetails.recording_url}">${classDetails.recording_url}</a></p>` : ''}
        ${classDetails.materials_url ? `<p><strong>Download Materials:</strong> <a href="${classDetails.materials_url}">${classDetails.materials_url}</a></p>` : ''}
        <br/>
        <p>Happy learning!</p>
        <p>Best Regards,<br/>The EduSkill Team</p>
      `,
    });
    console.log(`Class materials email sent to ${studentEmail}: %s`, info.messageId);
  } catch (error) {
    console.error(`Error sending class materials to ${studentEmail}:`, error);
  }
}

async function sendPaymentConfirmationEmail(studentEmail, studentName, paymentDetails) {
  try {
    const info = await transporter.sendMail({
      from: `"EduSkill" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: "Payment Confirmation - EduSkill",
      html: `
        <h2>Hi ${studentName},</h2>
        <p>We have successfully received your payment of <strong>₹${paymentDetails.amount}</strong>.</p>
        <p>Your enrollment for the ${paymentDetails.payment_for_type} is now confirmed.</p>
        <br/>
        <p>Best Regards,<br/>The EduSkill Team</p>
      `,
    });
    console.log("Payment confirmation email sent successfully: %s", info.messageId);
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
  }
}

async function sendPasswordResetEmail(studentEmail, studentName, resetToken) {
  try {
    // The frontend URL should be an environment variable for flexibility
    const resetUrl = `${process.env.FRONTEND_URL || 'https://eduskill.co.in'}/reset-password?token=${resetToken}`;

    const info = await transporter.sendMail({
      from: `"EduSkill" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: studentEmail,
      subject: "Password Reset Request - EduSkill",
      html: `
        <h2>Hi ${studentName},</h2>
        <p>A password reset was requested for your account by an administrator.</p>
        <p>Click the link below to set a new password. This link is valid for 1 hour.</p>
        <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Your Password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <br/>
        <p>Best Regards,<br/>The EduSkill Team</p>
      `,
    });
    console.log("Password reset email sent successfully: %s", info.messageId);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}

module.exports = { sendWelcomeEmail, sendClassReminderEmail, sendClassMaterialsEmail, sendPaymentConfirmationEmail, sendPasswordResetEmail };