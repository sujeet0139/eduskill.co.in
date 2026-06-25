const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');
const { sendPaymentConfirmationEmail } = require('../email');

// Screenshot uploads (image/PDF, 5 MB).
const upload = makeUpload({
  folder: 'eduskill/payments',
  prefix: 'payment-',
  maxSize: 5 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|pdf/,
  allowedMime: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
});

// 1. INITIATE A PAYMENT / ENROLLMENT
router.post('/initiate', async (req, res) => {
  const { student_id, item_type, item_id, batch_id, payment_plan } = req.body;
  // item_type: 'course', 'program', 'exam', 'registration'
  // payment_plan: 'full', 'split', 'emi'

  try {
    const connection = await pool.getConnection();

    // Get item price
    let itemPrice = 0;
    let itemTitle = '';
    if (item_type === 'registration') {
      itemPrice = 100; // Fixed registration fee
      itemTitle = 'One-time Registration Fee';
    } else if (item_type === 'course') {
      const [[course]] = await connection.query('SELECT price, title FROM courses WHERE id = ?', [item_id]);
      itemPrice = course ? course.price : 0;
      itemTitle = course ? course.title : 'Unknown Course';
    } else if (item_type === 'program') {
      const [[program]] = await connection.query('SELECT fee, title FROM programs WHERE id = ?', [item_id]);
      itemPrice = program ? program.fee : 0;
      itemTitle = program ? program.title : 'Unknown Program';
    } else if (item_type === 'exam') {
      const [[exam]] = await connection.query('SELECT fee, title FROM exams WHERE id = ?', [item_id]);
      itemPrice = exam ? exam.fee : 0;
      itemTitle = exam ? exam.title : 'Unknown Exam';
    }

    // Get student wallet balance
    const [[student]] = await connection.query('SELECT wallet_balance FROM students WHERE id = ?', [student_id]);
    const walletBalance = student ? student.wallet_balance : 0;

    const amountDue = itemPrice - walletBalance;

    // Case 1: Wallet covers the full cost
    if (amountDue <= 0) {
      const newWalletBalance = walletBalance - itemPrice;
      await connection.query('UPDATE students SET wallet_balance = ? WHERE id = ?', [newWalletBalance, student_id]);
      
      // Create a completed payment record
      await connection.query(
        `INSERT INTO payments (student_id, amount, payment_for_type, payment_for_id, payment_method, status) VALUES (?, ?, ?, ?, 'wallet', 'completed')`,
        [student_id, itemPrice, item_type, item_id]
      );
      
      // Enroll student
      if (item_type === 'course') {
        await connection.query('INSERT INTO student_courses (student_id, course_id, batch_id, status) VALUES (?, ?, ?, "enrolled") ON DUPLICATE KEY UPDATE status="enrolled"', [student_id, item_id, batch_id || null]);
        if (batch_id) await connection.query('UPDATE batches SET current_enrolled = current_enrolled + 1 WHERE id = ?', [batch_id]);
      } else if (item_type === 'program') {
        await connection.query('INSERT INTO student_programs (student_id, program_id, batch_id, status) VALUES (?, ?, ?, "enrolled") ON DUPLICATE KEY UPDATE status="enrolled"', [student_id, item_id, batch_id || null]);
        if (batch_id) await connection.query('UPDATE batches SET current_enrolled = current_enrolled + 1 WHERE id = ?', [batch_id]);
      }

      connection.release();
      return res.json({ success: true, message: 'Enrolled successfully using wallet balance.', payment_type: 'wallet' });
    }

    // Case 2: Payment is required (Calculate upfront cost based on plan)
    let upfrontAmount = amountDue;
    if (payment_plan === 'split') {
      upfrontAmount = Math.ceil(amountDue / 2); // 50% now
    } else if (payment_plan === 'emi') {
      upfrontAmount = Math.ceil(amountDue / 3); // ~33% now for 3 months
    }

    const [result] = await connection.query(
      `INSERT INTO payments (student_id, amount, payment_for_type, payment_for_id, status) VALUES (?, ?, ?, ?, 'pending')`,
      [student_id, upfrontAmount, item_type, item_id]
    );
    const parentPaymentId = result.insertId;

    // Generate future installments if Split or EMI
    if (payment_plan === 'split') {
      const remaining = amountDue - upfrontAmount;
      await connection.query(
        `INSERT INTO emi_installments (parent_payment_id, student_id, installment_no, amount_due, due_date) VALUES (?, ?, 2, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
        [parentPaymentId, student_id, remaining]
      );
    } else if (payment_plan === 'emi') {
      const remaining = amountDue - upfrontAmount;
      const emiAmount = Math.ceil(remaining / 2);
      await connection.query(
        `INSERT INTO emi_installments (parent_payment_id, student_id, installment_no, amount_due, due_date) VALUES 
        (?, ?, 2, ?, DATE_ADD(NOW(), INTERVAL 30 DAY)),
        (?, ?, 3, ?, DATE_ADD(NOW(), INTERVAL 60 DAY))`,
        [parentPaymentId, student_id, emiAmount, parentPaymentId, student_id, emiAmount]
      );
    }

    connection.release();

    res.json({
      success: true,
      message: 'Payment initiated.',
      payment_type: 'gateway',
      payment_id: parentPaymentId,
      amount_due: upfrontAmount,
      total_cost: amountDue,
      item_title: itemTitle,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. STUDENT: UPLOAD PROOF FOR A PENDING PAYMENT (Bank Transfer)
router.post('/:id/upload-proof', upload.single('screenshot'), async (req, res) => {
  const { transaction_id } = req.body;
  const screenshotPath = fileUrl(req.file);

  try {
    if (!screenshotPath) {
      return res.status(400).json({ error: 'Screenshot file is required.' });
    }
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE payments SET screenshot = ?, transaction_id = ?, payment_method = 'bank_transfer' WHERE id = ? AND status = 'pending'`,
      [screenshotPath, transaction_id, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Payment proof uploaded for verification.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. ADMIN: GET PAYMENTS (with filters)
router.get('/', async (req, res) => {
  const { status, student_id } = req.query;
  try {
    const connection = await pool.getConnection();
    let query = `SELECT p.*, s.name as student_name, s.email as student_email, s.reference_no as student_ref 
                 FROM payments p JOIN students s ON p.student_id = s.id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND p.status = ?'; params.push(status); }
    if (student_id) { query += ' AND p.student_id = ?'; params.push(student_id); }
    query += ' ORDER BY p.created_at DESC';

    const [payments] = await connection.query(query, params);
    connection.release();
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. ADMIN: APPROVE A PENDING PAYMENT
router.post('/:id/approve', async (req, res) => {
  const { transaction_id, notes } = req.body;
  try {
    const connection = await pool.getConnection();
    
    const [[payment]] = await connection.query('SELECT * FROM payments WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!payment) {
      connection.release();
      return res.status(404).json({ error: 'Pending payment not found.' });
    }

    await connection.query(
      `UPDATE payments SET status = 'completed', payment_date = NOW(), transaction_id = ?, notes = ? WHERE id = ?`,
      [transaction_id, notes, req.params.id]
    );

    const { student_id, payment_for_type, payment_for_id, amount } = payment;

    if (payment_for_type === 'registration') {
      await connection.query('UPDATE students SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, student_id]);
    } else if (payment_for_type === 'course') {
      await connection.query('INSERT INTO student_courses (student_id, course_id, status) VALUES (?, ?, "enrolled") ON DUPLICATE KEY UPDATE status="enrolled"', [student_id, payment_for_id]);
    } else if (item_type === 'program') {
      await connection.query('INSERT INTO student_programs (student_id, program_id, status) VALUES (?, ?, "enrolled") ON DUPLICATE KEY UPDATE status="enrolled"', [student_id, payment_for_id]);
    }

    await connection.query('UPDATE students SET status = "verified" WHERE id = ? AND status = "registered"', [student_id]);

    const [[student]] = await connection.query('SELECT name, email FROM students WHERE id = ?', [student_id]);
    connection.release();

    // Send confirmation email
    if (student) {
      await sendPaymentConfirmationEmail(student.email, student.name, payment);
    }

    res.json({ success: true, message: 'Payment approved successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. ADMIN: REJECT/REFUND A PAYMENT
router.post('/:id/reject', async (req, res) => {
  const { notes } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(`UPDATE payments SET status = 'failed', notes = ? WHERE id = ?`, [notes, req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Payment marked as failed/rejected.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Additional endpoints for refund requests, EMI management, etc. would go here.

module.exports = router;