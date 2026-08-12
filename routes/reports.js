const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ANALYTICS REPORTS
router.get('/summary', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Student Status Breakdown
    const [studentStats] = await connection.query(`
      SELECT status, COUNT(*) as count 
      FROM students 
      GROUP BY status
    `);
    
    // 2. Revenue Collection
    const [paymentStats] = await connection.query(`
      SELECT status, SUM(amount) as total_amount, COUNT(*) as count 
      FROM payments 
      GROUP BY status
    `);
    
    // 3. College-wise Enrollment
    const [collegeStats] = await connection.query(`
      SELECT c.name as college_name, COUNT(s.id) as student_count 
      FROM colleges c 
      LEFT JOIN students s ON c.id = s.college_id 
      GROUP BY c.id 
      ORDER BY student_count DESC
    `);

    // 4. Monthly Registration Trend (Current Year)
    const [monthlyRegistrations] = await connection.query(`
      SELECT MONTH(created_at) as month, COUNT(*) as count 
      FROM students 
      WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
      GROUP BY MONTH(created_at)
      ORDER BY month
    `);

    res.json({
      success: true,
      data: { studentStats, paymentStats, collegeStats, monthlyRegistrations }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 1. DASHBOARD OVERVIEW & REVENUE ANALYTICS
// ==========================================
router.get('/overview', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Revenue totals
    const [[revenue]] = await connection.query(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_revenue
      FROM payments
    `);

    // Monthly Revenue (Last 12 Months)
    const [monthlyRevenue] = await connection.query(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount) as revenue 
      FROM payments 
      WHERE status = 'completed' AND payment_date IS NOT NULL
      GROUP BY month 
      ORDER BY month DESC LIMIT 12
    `);
    
    // Revenue by Category (course vs program vs registration)
    const [revenueByCategory] = await connection.query(`
      SELECT payment_for_type, SUM(amount) as revenue 
      FROM payments 
      WHERE status = 'completed'
      GROUP BY payment_for_type
    `);

    // Active Students (Students with 'in_progress' or 'enrolled' courses or programs)
    const [[activeStudents]] = await connection.query(`
      SELECT COUNT(DISTINCT s.id) as count
      FROM students s
      LEFT JOIN student_courses sc ON s.id = sc.student_id AND sc.status IN ('enrolled', 'in_progress')
      LEFT JOIN student_programs sp ON s.id = sp.student_id AND sp.status IN ('enrolled', 'in_progress')
      WHERE sc.id IS NOT NULL OR sp.id IS NOT NULL
    `);

    res.json({ success: true, data: { revenue, monthlyRevenue, revenueByCategory, activeStudents: activeStudents.count } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 2. COURSE & INTERNSHIP ANALYTICS
// ==========================================
router.get('/courses', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Course Analytics
    const [courseStats] = await connection.query(`
      SELECT 
        c.id, c.title, 
        COUNT(sc.student_id) as total_enrollments,
        SUM(CASE WHEN sc.status = 'completed' THEN 1 ELSE 0 END) as total_completions,
        AVG(sc.progress_percent) as avg_progress_percent
      FROM courses c
      LEFT JOIN student_courses sc ON c.id = sc.course_id
      GROUP BY c.id
    `);

    // Program/Internship Analytics
    const [programStats] = await connection.query(`
      SELECT 
        p.id, p.title, 
        COUNT(sp.student_id) as total_enrollments,
        SUM(CASE WHEN sp.status = 'completed' THEN 1 ELSE 0 END) as total_completions
      FROM programs p
      LEFT JOIN student_programs sp ON p.id = sp.program_id
      GROUP BY p.id
    `);

    res.json({ success: true, data: { courses: courseStats, programs: programStats } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 3. STUDENT PERFORMANCE ANALYTICS
// ==========================================
router.get('/students', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Exam Performance Averages
    const [[examPerformance]] = await connection.query(`
      SELECT AVG(percentage) as average_score, COUNT(id) as total_attempts 
      FROM student_exam_attempts 
      WHERE status = 'graded'
    `);

    // Certificate Issuance Counts
    const [[certificateStats]] = await connection.query(`
      SELECT COUNT(*) as total_issued 
      FROM certificates 
      WHERE status = 'active'
    `);

    res.json({ success: true, data: { examPerformance, certificateStats } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 4. RECENT ACTIVITY FEED + "NEEDS ATTENTION" COUNTS (dashboard)
// ==========================================
router.get('/activity', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [registrations] = await connection.query(`
      SELECT id, name, created_at FROM students ORDER BY created_at DESC LIMIT 6
    `);
    const [recentPayments] = await connection.query(`
      SELECT p.id, p.amount, p.status, p.created_at, s.name AS student_name
      FROM payments p JOIN students s ON p.student_id = s.id
      ORDER BY p.created_at DESC LIMIT 6
    `);

    // Needs-attention counters.
    const [[pendingPay]] = await connection.query("SELECT COUNT(*) AS c FROM payments WHERE status = 'pending'");
    let pendingDocs = 0;
    try {
      const [[d]] = await connection.query("SELECT COUNT(*) AS c FROM student_documents WHERE status = 'pending_verification'");
      pendingDocs = d.c;
    } catch (e) { /* table may be empty/absent */ }
    let classesToday = 0;
    try {
      const [[c]] = await connection.query("SELECT COUNT(*) AS c FROM live_classes WHERE DATE(scheduled_at) = CURDATE()");
      classesToday = c.c;
    } catch (e) { /* ignore */ }

    res.json({
      success: true,
      data: {
        registrations,
        recentPayments,
        attention: { pendingPayments: pendingPay.c, pendingDocs, classesToday },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;