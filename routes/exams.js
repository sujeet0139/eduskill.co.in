const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// ADMIN: EXAM MANAGEMENT
// ==========================================

// 1. CREATE EXAM
router.post('/', async (req, res) => {
  const { title, type, course_id, program_id, passing_score, duration_minutes, fee, has_negative_marking, shuffle_questions, weightage_percent, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO exams (title, type, course_id, program_id, passing_score, duration_minutes, fee, has_negative_marking, shuffle_questions, weightage_percent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, type, course_id || null, program_id || null, passing_score || 50, duration_minutes || 60, fee || 0, has_negative_marking || false, shuffle_questions || false, weightage_percent || 100, status || 'draft']
    );
    res.status(201).json({ success: true, message: 'Exam created successfully', examId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 2. GET ALL EXAMS
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [exams] = await connection.query(`
      SELECT e.*, c.title as course_title, p.title as program_title,
             (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
      FROM exams e
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN programs p ON e.program_id = p.id
      ORDER BY e.created_at DESC
    `);
    res.json({ success: true, exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 3. GET EXAM DETAILS (with questions)
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[exam]] = await connection.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const [questions] = await connection.query('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY order_no ASC', [req.params.id]);

    // Parse JSON options string into an object
    const parsedQuestions = questions.map(q => ({...q, options: q.options ? JSON.parse(q.options) : null }));

    res.json({ success: true, exam: { ...exam, questions: parsedQuestions } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 4. ADD QUESTION TO EXAM
router.post('/:id/questions', async (req, res) => {
  const examId = req.params.id;
  const { question_text, type, options, correct_answer, marks, negative_marks } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO exam_questions (exam_id, question_text, type, options, correct_answer, marks, negative_marks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [examId, question_text, type, options ? JSON.stringify(options) : null, correct_answer, marks || 1, negative_marks || 0]
    );
    res.status(201).json({ success: true, message: 'Question added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 5. UPDATE EXAM
router.put('/:id', async (req, res) => {
  const { title, type, course_id, program_id, passing_score, duration_minutes, fee, has_negative_marking, shuffle_questions, weightage_percent, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE exams SET title=?, type=?, course_id=?, program_id=?, passing_score=?, duration_minutes=?, fee=?, has_negative_marking=?, shuffle_questions=?, weightage_percent=?, status=? WHERE id=?`,
      [title, type, course_id || null, program_id || null, passing_score || 50, duration_minutes || 60, fee || 0, has_negative_marking ? 1 : 0, shuffle_questions ? 1 : 0, weightage_percent || 100, status || 'draft', req.params.id]
    );
    res.json({ success: true, message: 'Exam updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 6. DELETE EXAM
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM exam_questions WHERE exam_id = ?', [req.params.id]);
    await connection.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 7. DELETE A QUESTION
router.delete('/:id/questions/:qid', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM exam_questions WHERE id = ? AND exam_id = ?', [req.params.qid, req.params.id]);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Note: Endpoints for students to take exams and for admins to grade them would be added here.

module.exports = router;