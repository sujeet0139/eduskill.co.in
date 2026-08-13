const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin, requireRole } = require('../middleware/authMiddleware');

// Editing the public registration form's field set is "system config"
// (master-dev-prompt Section H#2) -- kept away from the Admin/Data-Entry-
// Staff tier ('moderator'). Reading the fields stays open (the public
// registration page itself needs it, unauthenticated).

// GET ALL REGISTRATION FIELDS
router.get('/registration', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [fields] = await connection.query('SELECT * FROM registration_fields ORDER BY order_no ASC');
    res.json({ success: true, fields });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE A NEW CUSTOM FIELD
router.post('/registration', requireAdmin, requireRole('admin'), async (req, res) => {
  const { label, type, is_mandatory, options } = req.body;
  if (!label || !type) {
    return res.status(400).json({ error: 'Label and type are required.' });
  }

  // Normalise options for "select" fields into a clean JSON array of strings.
  let optionsJson = null;
  if (type === 'select') {
    const list = Array.isArray(options)
      ? options
      : String(options || '').split(/\r?\n|,/);
    const cleaned = list.map((o) => String(o).trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return res.status(400).json({ error: 'A dropdown (select) field needs at least one option.' });
    }
    optionsJson = JSON.stringify(cleaned);
  }

  // Generate a unique field_name from the label
  const field_name = `custom_${label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO registration_fields (field_name, label, type, is_standard, is_enabled, is_mandatory, options)
       VALUES (?, ?, ?, FALSE, TRUE, ?, ?)`,
      [field_name, label, type, is_mandatory || false, optionsJson]
    );
    res.status(201).json({ success: true, message: 'Custom field created successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create custom field', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// BULK UPDATE REGISTRATION FIELDS
router.put('/registration', requireAdmin, requireRole('admin'), async (req, res) => {
  const { fields } = req.body; // Expects an array of field objects
  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: 'Invalid payload. Expected an array of fields.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const field of fields) {
      await connection.query(
        'UPDATE registration_fields SET label = ?, is_enabled = ?, is_mandatory = ? WHERE id = ?',
        [field.label, field.is_enabled, field.is_mandatory, field.id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Registration form settings updated successfully.' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Failed to update settings', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// REORDER FIELDS — body { order: [id1, id2, ...] } in the desired display order.
// Defined before "/registration/:id" so "reorder" isn't captured as an :id.
router.put('/registration/reorder', requireAdmin, requireRole('admin'), async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of field ids.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let i = 0; i < order.length; i++) {
      await connection.query('UPDATE registration_fields SET order_no = ? WHERE id = ?', [i, order[i]]);
    }
    await connection.commit();
    res.json({ success: true, message: 'Field order updated.' });
  } catch (error) {
    if (connection) { await connection.rollback(); }
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// EDIT A SINGLE FIELD. Label/enabled/mandatory are editable for all fields.
// Type & options can only change for CUSTOM (non-standard) fields to protect
// system fields like email/password.
router.put('/registration/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const { label, is_mandatory, is_enabled, type, options } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const [[field]] = await connection.query('SELECT * FROM registration_fields WHERE id = ?', [req.params.id]);
    if (!field) { return res.status(404).json({ error: 'Field not found.' }); }

    // Resolve final type + options (only custom fields may change type/options).
    let finalType = field.type;
    let finalOptions = field.options;
    if (!field.is_standard) {
      if (type) finalType = type;
      if (finalType === 'select') {
        const list = Array.isArray(options) ? options : String(options || '').split(/\r?\n|,/);
        const cleaned = list.map((o) => String(o).trim()).filter(Boolean);
        if (cleaned.length === 0) { return res.status(400).json({ error: 'A dropdown field needs at least one option.' }); }
        finalOptions = JSON.stringify(cleaned);
      } else {
        finalOptions = null;
      }
    }

    await connection.query(
      'UPDATE registration_fields SET label = ?, is_mandatory = ?, is_enabled = ?, type = ?, options = ? WHERE id = ?',
      [
        label ?? field.label,
        is_mandatory !== undefined ? (is_mandatory ? 1 : 0) : field.is_mandatory,
        is_enabled !== undefined ? (is_enabled ? 1 : 0) : field.is_enabled,
        finalType,
        finalOptions,
        req.params.id,
      ]
    );
    res.json({ success: true, message: 'Field updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE A CUSTOM FIELD
router.delete('/registration/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const fieldId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    // Important: Only allow deleting non-standard fields to protect the system
    const [result] = await connection.query(
      'DELETE FROM registration_fields WHERE id = ? AND is_standard = FALSE',
      [fieldId]
    );
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Cannot delete a standard field or field not found.' });
    }
    res.json({ success: true, message: 'Custom field deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete custom field', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;