const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const nodemailer = require('nodemailer');
const { makeUpload, fileUrl } = require('../config/storage');

// Screenshot uploads (image/PDF, 5 MB). Goes to Cloudinary in production,
// local disk in development. See config/storage.js.
const upload = makeUpload({
  folder: 'eduskill/payments',
  prefix: 'payment-',
  maxSize: 5 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|pdf/,
  allowedMime: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
});

// 1. STUDENT: UPLOAD PAYMENT SCREENSHOT
router.post('/upload', upload.single('screenshot'), async (req, res) => {
  const { studentId, transactionId, amount } = req.body;
  const screenshotPath = fileUrl(req.file);

  try {
    if (!studentId || !screenshotPath) {
      return res.status(400).json({ error: 'Missing required fields or screenshot' });
    }

    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO payments (student_id, amount, transaction_id, status, screenshot) 
       VALUES (?, ?, ?, 'pending', ?)`,
      [studentId, amount || 1000, transactionId, screenshotPath]
    );
    connection.release();

    res.json({ success: true, message: 'Payment screenshot uploaded successfully' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload payment details' });
  }
});

// 2. STUDENT: GET PAYMENT STATUS
router.get('/status/:studentId', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [payments] = await connection.query(
      'SELECT * FROM payments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.studentId]
    );
    connection.release();
    res.json(payments.length > 0 ? payments[0] : { status: 'none' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. ADMIN: GET ALL PAYMENTS
router.get('/all', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [payments] = await connection.query(
      `SELECT p.*, s.name, s.email, s.reference_no, s.phone 
       FROM payments p 
       JOIN students s ON p.student_id = s.id 
       ORDER BY p.created_at DESC`
    );
    
    // If admin approves a payment, we update BOTH tables
    if (req.query.approveId) {
       // Logic to approve payment goes here (usually a separate POST route)
    }
    connection.release();
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. ADMIN: APPROVE PAYMENT
router.post('/approve', async (req, res) => {
  const { paymentId, studentId } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE payments SET status = "completed" WHERE id = ?', [paymentId]);
    await connection.query('UPDATE students SET status = "verified" WHERE id = ?', [studentId]);
    
    // Fetch student details to send confirmation email
    const [students] = await connection.query('SELECT name, email, reference_no FROM students WHERE id = ?', [studentId]);
    connection.release();

    if (students.length > 0) {
      const student = students[0];
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
          port: process.env.SMTP_PORT || 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: student.email,
          subject: 'Payment Verified & Admission Confirmed - eduskill.co.in',
          html: `
            <h2>Congratulations ${student.name}!</h2>
            <p>Your payment has been successfully verified by our administration team.</p>
            <p>Your admission status is now <strong>Confirmed</strong>.</p>
            <p><strong>Reference Number:</strong> ${student.reference_no}</p>
            <br/>
            <p>Best Regards,<br/>Eduskill Team</p>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send approval email:', emailErr);
      }
    }

    res.json({ success: true, message: 'Payment approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: MANUAL PAYMENT
router.post('/manual', async (req, res) => {
  const { studentId, amount, paymentMode, referenceNo, paymentDate, notes } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO payments (student_id, amount, transaction_id, status, payment_date) 
       VALUES (?, ?, ?, 'completed', ?)`,
      [studentId, amount, referenceNo || paymentMode, paymentDate || new Date()]
    );
    await connection.query('UPDATE students SET status = "verified" WHERE id = ?', [studentId]);
    connection.release();
    res.json({ success: true, message: 'Manual payment added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: REFUND PAYMENT
router.put('/:id/refund', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE payments SET status = "failed" WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Payment refunded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;