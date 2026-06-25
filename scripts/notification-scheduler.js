const cron = require('node-cron');
const pool = require('../config/db');
const { sendClassReminderEmail } = require('../email');

async function getStudentsForClass(connection, classDetails) {
  let studentQuery = `SELECT id, name, email FROM students WHERE status = 'verified'`;
  const studentParams = [];

  if (classDetails.college_id) {
    studentQuery += ' AND college_id = ?';
    studentParams.push(classDetails.college_id);
  }
  if (classDetails.course_id) {
    studentQuery += ' AND id IN (SELECT student_id FROM student_courses WHERE course_id = ?)';
    studentParams.push(classDetails.course_id);
  }
  // If neither is set, it will select all verified students.

  const [students] = await connection.query(studentQuery, studentParams);
  return students;
}

/**
 * Finds classes scheduled in the next 24-hour window and sends email reminders.
 * Runs every hour.
 */
async function send24HourReminders() {
  console.log(`[CRON] Checking for 24-hour class reminders...`);
  let connection;
  try {
    connection = await pool.getConnection();
    const [classes] = await connection.query(
      `SELECT * FROM live_classes 
       WHERE status = 'scheduled' 
       AND is_24hr_reminder_sent = FALSE
       AND scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 25 HOUR)`
    );

    if (classes.length === 0) return;

    console.log(`[CRON] Found ${classes.length} class(es) for 24-hour reminders.`);

    for (const cls of classes) {
      const students = await getStudentsForClass(connection, cls);
      for (const student of students) {
        await sendClassReminderEmail(student.email, student.name, cls);
      }
      // Mark as sent
      await connection.query('UPDATE live_classes SET is_24hr_reminder_sent = TRUE WHERE id = ?', [cls.id]);
    }
  } catch (error) {
    console.error('[CRON] Error in 24-hour reminder job:', error.message);
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Finds classes scheduled in the next 60-minute window and sends final reminders.
 * Runs every 5 minutes.
 */
async function send1HourReminders() {
  console.log(`[CRON] Checking for 1-hour class reminders...`);
  let connection;
  try {
    connection = await pool.getConnection();
    const [classes] = await connection.query(
      `SELECT * FROM live_classes 
       WHERE status = 'scheduled' 
       AND is_1hr_reminder_sent = FALSE
       AND scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 61 MINUTE)`
    );

    if (classes.length === 0) return;

    console.log(`[CRON] Found ${classes.length} class(es) for 1-hour reminders.`);

    for (const cls of classes) {
      const students = await getStudentsForClass(connection, cls);
      for (const student of students) {
        // Placeholder for SMS / WhatsApp notifications
        // e.g., await sendSms(student.phone, `Class '${cls.title}' is starting in 1 hour.`);
        // e.g., await sendWhatsApp(student.phone, `Reminder: Class '${cls.title}' starts soon! Link: ${cls.meet_link}`);
      }
      // Mark as sent
      await connection.query('UPDATE live_classes SET is_1hr_reminder_sent = TRUE WHERE id = ?', [cls.id]);
    }
  } catch (error) {
    console.error('[CRON] Error in 1-hour reminder job:', error.message);
  } finally {
    if (connection) connection.release();
  }
}

function start() {
  // Schedule to run at the top of every hour
  cron.schedule('0 * * * *', send24HourReminders);

  // Schedule to run every 5 minutes for final reminders
  cron.schedule('*/5 * * * *', send1HourReminders);
}

module.exports = { start };