"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { Button, Alert, Input, Select } from "@/components/ui";

export default function RegistrationSettingsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text', is_mandatory: false, options: '' });

  const token = () => adminAuth.token();

  const loadFields = () => {
    setLoading(true);
    api.get("/api/form-settings/registration", token())
      .then(res => setFields(res.fields || []))
      .catch(err => setError("Failed to load form fields: " + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadFields, []);

  const handleToggle = (id, key) => {
    setFields(prevFields =>
      prevFields.map(field =>
        field.id === id ? { ...field, [key]: !field[key] } : field
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // We need to convert boolean to 0/1 for the backend
      const payload = fields.map(f => ({
        ...f,
        is_enabled: f.is_enabled ? 1 : 0,
        is_mandatory: f.is_mandatory ? 1 : 0,
      }));
      await api.put("/api/form-settings/registration", { fields: payload }, token());
      setSuccess("Settings saved successfully!");
      loadFields(); // Re-fetch the data to show the latest state
    } catch (err) {
      setError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewField = async (e) => {
    e.preventDefault();
    if (newField.type === 'select' && !newField.options.trim()) {
      alert("Please enter at least one option for the dropdown (one per line).");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: newField.label,
        type: newField.type,
        is_mandatory: newField.is_mandatory,
        options: newField.type === 'select'
          ? newField.options.split(/\r?\n/).map(o => o.trim()).filter(Boolean)
          : undefined,
      };
      await api.post("/api/form-settings/registration", payload, token());
      setShowAddModal(false);
      setNewField({ label: '', type: 'text', is_mandatory: false, options: '' });
      loadFields(); // Re-fetch the data to show the new field
    } catch (err) {
      alert("Failed to add field: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (id) => {
    if (!confirm("Are you sure you want to delete this custom field? This cannot be undone.")) return;
    try {
      await api.del(`/api/form-settings/registration/${id}`, token());
      loadFields(); // Refresh the list
    } catch (err) {
      alert("Failed to delete field: " + err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Registration Form Settings"
        subtitle="Configure the fields displayed on the student registration form."
        action={
          <Button onClick={() => setShowAddModal(true)}>
            + Add Custom Field
          </Button>
        }
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Field Label</Th>
            <Th>Enabled</Th>
            <Th>Mandatory</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><Td colSpan="4" className="text-center">Loading...</Td></tr>
          ) : (
            fields.map(field => (
              <tr key={field.id}>
                <Td className="font-medium">{field.label} {!field.is_standard && <span className="text-xs text-gray-400 ml-2">(Custom)</span>}</Td>
                <Td>
                  <input type="checkbox" checked={!!field.is_enabled} onChange={() => handleToggle(field.id, 'is_enabled')} className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
                </Td>
                <Td>
                  <input type="checkbox" checked={!!field.is_mandatory} onChange={() => handleToggle(field.id, 'is_mandatory')} className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
                </Td>
                <Td>
                  {!field.is_standard && (
                    <button onClick={() => handleDeleteField(field.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">
                      Delete
                    </button>
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          Save Changes
        </Button>
      </div>

      <Modal open={showAddModal} title="Add New Custom Field" onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleAddNewField} className="space-y-4">
          <Input label="Field Label" placeholder="e.g., Father's Occupation" value={newField.label} onChange={(e) => setNewField({...newField, label: e.target.value})} required />
          <Select label="Field Type" value={newField.type} onChange={(e) => setNewField({...newField, type: e.target.value})}>
            <option value="text">Text (Single Line)</option>
            <option value="number">Number</option>
            <option value="tel">Phone Number</option>
            <option value="email">Email</option>
            <option value="select">Dropdown (Select)</option>
          </Select>
          {newField.type === 'select' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dropdown Options</label>
              <textarea
                value={newField.options}
                onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                placeholder={"One option per line, e.g.\nGeneral\nOBC\nSC\nST"}
                rows={4}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">Enter each choice on its own line.</p>
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newField.is_mandatory} onChange={(e) => setNewField({...newField, is_mandatory: e.target.checked})} />
            <span className="text-sm">Make this field mandatory</span>
          </label>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <Button type="submit" loading={saving}>Add Field</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}