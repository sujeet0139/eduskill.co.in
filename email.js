const nodemailer = require('nodemailer');
const pool = require('./config/db');

// SMTP config is admin-configurable: it is read from the `settings` table (saved
// from the admin Settings page) and falls back to environment variables. Settings
// are cached briefly so we don't hit the DB on every email.
let cache = { at: 0, cfg: null };
const CACHE_MS = 60 * 1000;

async function loadConfig() {
  if (cache.cfg && Date.now() - cache.at < CACHE_MS) return cache.cfg;
  let db = {};
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'smtp\\_%'"
    );
    connection.release();
    db = rows.reduce((acc, r) => { acc[r.setting_key] = r.setting_value; return acc; }, {});
  } catch (e) {
    console.warn('Could not read SMTP settings from DB, falling back to env:', e.message);
  }

  const cfg = {
    host: db.smtp_host || process.env.SMTP_HOST,
    port: Number(db.smtp_port || process.env.SMTP_PORT || 587),
    user: db.smtp_user || process.env.SMTP_USER,
    pass: db.smtp_password || process.env.SMTP_PASSWORD,
    fromName: db.smtp_from_name || 'EduSkill',
    fromEmail: db.smtp_from_email || process.env.SMTP_FROM || db.smtp_user || process.env.SMTP_USER,
  };
  cache = { at: Date.now(), cfg };
  return cfg;
}

async function getTransport() {
  const cfg = await loadConfig();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return { transporter, from: `"${cfg.fromName}" <${cfg.fromEmail}>` };
}

async function send(to, subject, html) {
  const { transporter, from } = await getTransport();
  const info = await transporter.sendMail({ from, to, subject, html });
  console.log(`Email sent (${subject}) -> ${to}: ${info.messageId}`);
  return info;
}

async function sendWelcomeEmail(studentEmail, studentName, referenceNo) {
  try {
    await send(studentEmail, 'Welcome to EduSkill - Registration Successful!', `
      <h2>Welcome to EduSkill, ${studentName}!</h2>
      <p>Your registration was successful.</p>
      <p>Your Reference Number is: <strong>${referenceNo}</strong></p>
      <p>Please use your Email and password (or Reference Number) to log in to your student dashboard.</p>
      <br/><p>Best Regards,<br/>The EduSkill Team</p>
    `);
  } catch (error) {
    console.error('Error sending welcome email:', error.message);
  }
}

async function sendClassReminderEmail(studentEmail, studentName, classDetails) {
  try {
    const scheduledTime = new Date(classDetails.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    await send(studentEmail, `Class Reminder: ${classDetails.title}`, `
      <h2>Hi ${studentName},</h2>
      <p>This is a reminder for your upcoming live class.</p>
      <p><strong>Class:</strong> ${classDetails.title}</p>
      <p><strong>Topic:</strong> ${classDetails.topic || 'N/A'}</p>
      <p><strong>Scheduled for:</strong> ${scheduledTime}</p>
      <p><strong>Meeting Link:</strong> <a href="${classDetails.meet_link}">${classDetails.meet_link}</a></p>
      <br/><p>Best Regards,<br/>The EduSkill Team</p>
    `);
  } catch (error) {
    console.error(`Error sending class reminder to ${studentEmail}:`, error.message);
  }
}

async function sendClassMaterialsEmail(studentEmail, studentName, classDetails) {
  try {
    await send(studentEmail, `Recording & Materials for: ${classDetails.title}`, `
      <h2>Hi ${studentName},</h2>
      <p>The recording and materials for "<strong>${classDetails.title}</strong>" are now available.</p>
      ${classDetails.recording_url ? `<p><strong>Watch Recording:</strong> <a href="${classDetails.recording_url}">${classDetails.recording_url}</a></p>` : ''}
      ${classDetails.materials_url ? `<p><strong>Download Materials:</strong> <a href="${classDetails.materials_url}">${classDetails.materials_url}</a></p>` : ''}
      <br/><p>Happy learning!</p><p>Best Regards,<br/>The EduSkill Team</p>
    `);
  } catch (error) {
    console.error(`Error sending class materials to ${studentEmail}:`, error.message);
  }
}

async function sendPaymentConfirmationEmail(studentEmail, studentName, paymentDetails) {
  try {
    await send(studentEmail, 'Payment Confirmation - EduSkill', `
      <h2>Hi ${studentName},</h2>
      <p>We have successfully received your payment of <strong>₹${paymentDetails.amount}</strong>.</p>
      <p>Your enrollment for the ${paymentDetails.payment_for_type} is now confirmed.</p>
      <br/><p>Best Regards,<br/>The EduSkill Team</p>
    `);
  } catch (error) {
    console.error('Error sending payment confirmation email:', error.message);
  }
}

async function sendPasswordResetEmail(studentEmail, studentName, resetToken) {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://eduskill.co.in'}/reset-password?token=${resetToken}`;
    await send(studentEmail, 'Password Reset Request - EduSkill', `
      <h2>Hi ${studentName},</h2>
      <p>A password reset was requested for your account.</p>
      <p>Click the link below to set a new password. This link is valid for 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#1e3a8a;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">Reset Your Password</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <br/><p>Best Regards,<br/>The EduSkill Team</p>
    `);
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
  }
}

module.exports = { send, sendWelcomeEmail, sendClassReminderEmail, sendClassMaterialsEmail, sendPaymentConfirmationEmail, sendPasswordResetEmail };
