const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Admin-side syllabus management (master-dev-prompt Section G). Mounted at
// /api/syllabus with requireAdmin in server.js.

// GET topics for a course, in order.
router.get('/courses/:courseId/topics', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [topics] = await connection.query(
      'SELECT * FROM syllabus_topics WHERE course_id = ? ORDER BY order_no ASC, id ASC',
      [req.params.courseId]
    );
    res.json({ success: true, topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE a topic (appended to the end of the course's list by default).
router.post('/courses/:courseId/topics', async (req, res) => {
  const { title, order_no } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    let orderNo = order_no;
    if (orderNo === undefined || orderNo === null) {
      const [[row]] = await connection.query('SELECT COALESCE(MAX(order_no), 0) + 1 AS next FROM syllabus_topics WHERE course_id = ?', [req.params.courseId]);
      orderNo = row.next;
    }
    await connection.query(
      'INSERT INTO syllabus_topics (course_id, title, order_no) VALUES (?, ?, ?)',
      [req.params.courseId, title, orderNo]
    );
    res.status(201).json({ success: true, message: 'Topic added.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/topics/:id', async (req, res) => {
  const { title, order_no } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE syllabus_topics SET title=?, order_no=? WHERE id=?', [title, order_no, req.params.id]);
    res.json({ success: true, message: 'Topic updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/topics/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM syllabus_topics WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Topic deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Admin per-batch progress view (Section G item 4): progress bar (X of Y
// topics done) + per-topic breakdown of who covered it, when, and the
// student confirmation split. Also flags topics past the ~30% "need
// revision" threshold (item 5) so a weak spot doesn't wait for a later
// result to surface.
router.get('/batches/:batchId/progress', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[batch]] = await connection.query('SELECT id, course_id FROM batches WHERE id = ?', [req.params.batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    const [topics] = await connection.query(`
      SELECT
        st.id, st.title, st.order_no,
        btp.status, btp.covered_at, t.name AS covered_by_name,
        (SELECT COUNT(*) FROM topic_confirmations tc WHERE tc.topic_id = st.id AND tc.batch_id = ?) AS total_confirmations,
        (SELECT COUNT(*) FROM topic_confirmations tc WHERE tc.topic_id = st.id AND tc.batch_id = ? AND tc.confirmation = 'got_it') AS got_it_count,
        (SELECT COUNT(*) FROM topic_confirmations tc WHERE tc.topic_id = st.id AND tc.batch_id = ? AND tc.confirmation = 'need_revision') AS need_revision_count,
        (SELECT COUNT(*) FROM topic_confirmations tc WHERE tc.topic_id = st.id AND tc.batch_id = ? AND tc.confirmation = 'didnt_attend') AS didnt_attend_count
      FROM syllabus_topics st
      LEFT JOIN batch_topic_progress btp ON btp.topic_id = st.id AND btp.batch_id = ?
      LEFT JOIN teachers t ON btp.covered_by = t.id
      WHERE st.course_id = ?
      ORDER BY st.order_no ASC, st.id ASC
    `, [req.params.batchId, req.params.batchId, req.params.batchId, req.params.batchId, req.params.batchId, batch.course_id]);

    const withFlags = topics.map((t) => ({
      ...t,
      status: t.status || 'not_started',
      needs_revision_alert: t.total_confirmations > 0 && (t.need_revision_count / t.total_confirmations) >= 0.3,
    }));

    const completedCount = withFlags.filter((t) => t.status === 'completed').length;
    res.json({
      success: true,
      topics: withFlags,
      summary: { total: withFlags.length, completed: completedCount },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
