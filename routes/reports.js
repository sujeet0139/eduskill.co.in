const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ANALYTICS REPORTS
router.get('/summary', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
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

    connection.release();
    res.json({ 
      success: true, 
      data: { studentStats, paymentStats, collegeStats, monthlyRegistrations } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;