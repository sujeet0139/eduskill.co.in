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
  const { student_id, item_type, item_id, batch_id, payment_plan, amount } = req.body;
  // item_type: 'course', 'program', 'exam', 'registration'
  // payment_plan: 'full', 'split', 'emi'
  // amount: optional custom amount the student chooses to pay now (>= min, <= total)

  try {
    const connection = await pool.getConnection();

    // Get item price and the admin-configured minimum first payment
    let itemPrice = 0;
    let minPayment = 0;
    let itemTitle = '';
    if (item_type === 'registration') {
      itemPrice = 100; // Fixed registration fee
      itemTitle = 'One-time Registration Fee';
    } else if (item_type === 'course') {
      const [[course]] = await connection.query('SELECT price, min_payment, title FROM courses WHERE id = ?', [item_id]);
      itemPrice = course ? Number(course.price) : 0;
      minPayment = course ? Number(course.min_payment || 0) : 0;
      itemTitle = course ? course.title : 'Unknown Course';
    } else if (item_type === 'program') {
      const [[program]] = await connection.query('SELECT fee, min_payment, title FROM programs WHERE id = ?', [item_id]);
      itemPrice = program ? Number(program.fee) : 0;
      minPayment = program ? Number(program.min_payment || 0) : 0;
      itemTitle = program ? program.title : 'Unknown Program';
    } else if (item_type === 'exam') {
      const [[exam]] = await connection.query('SELECT fee, title FROM exams WHERE id = ?', [item_id]);
      itemPrice = exam ? Number(exam.fee) : 0;
      itemTitle = exam ? exam.title : 'Unknown Exam';
    }

    // How much has the student already paid (and had approved) for THIS item?
    const [[paidRow]] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments
       WHERE student_id = ? AND payment_for_type = ? AND payment_for_id = ? AND status = 'completed'`,
      [student_id, item_type, item_id || null]
    );
    const alreadyPaid = Number(paidRow.paid || 0);
    const remainingPrice = Math.max(0, itemPrice - alreadyPaid);

    // Get student wallet balance
    const [[student]] = await connection.query('SELECT wallet_balance FROM students WHERE id = ?', [student_id]);
    const walletBalance = student ? Number(student.wallet_balance) : 0;

    const amountDue = remainingPrice - walletBalance;

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

    // Case 2: Payment is required.
    // If the student supplied a custom amount (full / partial / minimum), honour it
    // after validating it against the admin-set minimum and the total due.
    let upfrontAmount = amountDue;
    if (amount !== undefined && amount !== null && amount !== '') {
      const chosen = Number(amount);
      if (isNaN(chosen) || chosen <= 0) {
        connection.release();
        return res.status(400).json({ error: 'Enter a valid payment amount.' });
      }
      // The minimum only applies to the FIRST payment; once something is paid,
      // the student can pay any remaining amount.
      const floor = alreadyPaid > 0 ? 1 : (minPayment > 0 ? Math.min(minPayment, amountDue) : 1);
      if (chosen < floor) {
        connection.release();
        return res.status(400).json({ error: `Minimum payment for this is ₹${floor}.` });
      }
      if (chosen > amountDue) {
        connection.release();
        return res.status(400).json({ error: `Amount cannot exceed the balance due of ₹${amountDue}.` });
      }
      upfrontAmount = chosen;
    } else if (payment_plan === 'split') {
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
    } else if (payment_for_type === 'program') {
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

// 6. ADMIN: GET ALL PAYMENTS (alias of list, used by the admin payments page)
router.get('/all', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [payments] = await connection.query(
      `SELECT p.*, s.name, s.email, s.reference_no
       FROM payments p JOIN students s ON p.student_id = s.id
       ORDER BY p.created_at DESC`
    );
    connection.release();
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. ADMIN: ADD A MANUAL (offline) PAYMENT — recorded as completed
router.post('/manual', async (req, res) => {
  const { studentId, amount, referenceNo, paymentDate, item_type, item_id } = req.body;
  if (!studentId || !amount) {
    return res.status(400).json({ error: 'Student ID and amount are required.' });
  }
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO payments (student_id, amount, payment_for_type, payment_for_id, payment_method, status, payment_date, transaction_id)
       VALUES (?, ?, ?, ?, 'bank_transfer', 'completed', ?, ?)`,
      [studentId, amount, item_type || 'registration', item_id || null, paymentDate || new Date(), referenceNo || null]
    );
    connection.release();
    res.json({ success: true, message: 'Manual payment recorded.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Additional endpoints for refund requests, EMI management, etc. would go here.

module.exports = router;