"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { Button, Alert, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";

// Turn a stored options value (JSON string or array) into newline text for editing.
function optionsToText(options) {
  if (!options) return "";
  let arr = options;
  if (typeof options === "string") { try { arr = JSON.parse(options); } catch { return options; } }
  return Array.isArray(arr) ? arr.map((o) => (typeof o === "object" ? o.label ?? o.value : o)).join("\n") : "";
}

export default function RegistrationSettingsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newField, setNewField] = useState({ label: "", type: "text", is_mandatory: false, options: "" });

  // Edit + drag state
  const [editField, setEditField] = useState(null); // the field being edited
  const [editForm, setEditForm] = useState({ label: "", type: "text", is_mandatory: false, is_enabled: true, options: "" });
  const [dragIndex, setDragIndex] = useState(null);

  const token = () => adminAuth.token();
  const notify = useToast();

  const loadFields = () => {
    setLoading(true);
    api.get("/api/form-settings/registration", token())
      .then((res) => setFields(res.fields || []))
      .catch((err) => setError("Failed to load form fields: " + err.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadFields, []);

  const handleToggle = (id, key) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: !f[key] } : f)));
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = fields.map((f) => ({ ...f, is_enabled: f.is_enabled ? 1 : 0, is_mandatory: f.is_mandatory ? 1 : 0 }));
      await api.put("/api/form-settings/registration", { fields: payload }, token());
      setSuccess("Settings saved successfully!");
      loadFields();
    } catch (err) {
      setError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewField = async (e) => {
    e.preventDefault();
    if (newField.type === "select" && !newField.options.trim()) {
      notify.toast("Please enter at least one option for the dropdown (one per line).");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: newField.label, type: newField.type, is_mandatory: newField.is_mandatory,
        options: newField.type === "select" ? newField.options.split(/\r?\n/).map((o) => o.trim()).filter(Boolean) : undefined,
      };
      await api.post("/api/form-settings/registration", payload, token());
      setShowAddModal(false);
      setNewField({ label: "", type: "text", is_mandatory: false, options: "" });
      loadFields();
    } catch (err) {
      notify.error("Failed to add field: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (id) => {
    if (!(await notify.confirm("Are you sure you want to delete this custom field? This cannot be undone."))) return;
    try {
      await api.del(`/api/form-settings/registration/${id}`, token());
      loadFields();
    } catch (err) {
      notify.error("Failed to delete field: " + err.message);
    }
  };

  // ---- Edit existing field ----
  const openEdit = (f) => {
    setEditField(f);
    setEditForm({
      label: f.label || "", type: f.type || "text",
      is_mandatory: !!f.is_mandatory, is_enabled: !!f.is_enabled,
      options: optionsToText(f.options),
    });
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        label: editForm.label, is_mandatory: editForm.is_mandatory, is_enabled: editForm.is_enabled,
      };
      if (!editField.is_standard) {
        payload.type = editForm.type;
        if (editForm.type === "select") payload.options = editForm.options.split(/\r?\n/).map((o) => o.trim()).filter(Boolean);
      }
      await api.put(`/api/form-settings/registration/${editField.id}`, payload, token());
      setEditField(null);
      notify.success("Field updated.");
      loadFields();
    } catch (err) {
      notify.error("Failed to update field: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Drag to reorder ----
  const onDragStart = (i) => setDragIndex(i);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = async (i) => {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); return; }
    const reordered = [...fields];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(i, 0, moved);
    setFields(reordered);
    setDragIndex(null);
    try {
      await api.put("/api/form-settings/registration/reorder", { order: reordered.map((f) => f.id) }, token());
      notify.success("Order updated.");
    } catch (err) {
      notify.error("Failed to save order: " + err.message);
      loadFields();
    }
  };

  return (
    <>
      <PageHeader
        title="Registration Form Builder"
        subtitle="Drag to reorder, edit any field, toggle visibility, or add custom fields."
        action={<Button onClick={() => setShowAddModal(true)}>+ Add Custom Field</Button>}
      />

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <p className="mb-2 text-xs text-gray-400">Tip: drag the ⠿ handle to change the order fields appear on the registration form.</p>

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th></Th><Th>Field Label</Th><Th>Type</Th><Th>Enabled</Th><Th>Mandatory</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><Td colSpan="6" className="text-center">Loading...</Td></tr>
          ) : (
            fields.map((field, i) => (
              <tr
                key={field.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(i)}
                className={`hover:bg-gray-50 ${dragIndex === i ? "opacity-50" : ""}`}
              >
                <Td className="cursor-grab select-none text-gray-400" title="Drag to reorder">⠿</Td>
                <Td className="font-medium">{field.label} {!field.is_standard && <span className="ml-2 text-xs text-gray-400">(Custom)</span>}</Td>
                <Td className="text-xs capitalize text-gray-500">{field.type}</Td>
                <Td><input type="checkbox" checked={!!field.is_enabled} onChange={() => handleToggle(field.id, "is_enabled")} className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" /></Td>
                <Td><input type="checkbox" checked={!!field.is_mandatory} onChange={() => handleToggle(field.id, "is_mandatory")} className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" /></Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(field)} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">Edit</button>
                    {!field.is_standard && (
                      <button onClick={() => handleDeleteField(field.id)} className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">Delete</button>
                    )}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>Save Changes</Button>
      </div>

      {/* Add modal */}
      <Modal open={showAddModal} title="Add New Custom Field" onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleAddNewField} className="space-y-4">
          <Input label="Field Label" placeholder="e.g., Father's Occupation" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} required />
          <Select label="Field Type" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}>
            <option value="text">Text (Single Line)</option>
            <option value="number">Number</option>
            <option value="tel">Phone Number</option>
            <option value="email">Email</option>
            <option value="select">Dropdown (Select)</option>
          </Select>
          {newField.type === "select" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dropdown Options</label>
              <textarea value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                placeholder={"One option per line, e.g.\nGeneral\nOBC\nSC\nST"} rows={4}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
              <p className="mt-1 text-xs text-gray-400">Enter each choice on its own line.</p>
            </div>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newField.is_mandatory} onChange={(e) => setNewField({ ...newField, is_mandatory: e.target.checked })} />
            <span className="text-sm">Make this field mandatory</span>
          </label>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <Button type="submit" loading={saving}>Add Field</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editField} title={`Edit Field${editField?.is_standard ? " (standard)" : ""}`} onClose={() => setEditField(null)}>
        {editField && (
          <form onSubmit={saveEdit} className="space-y-4">
            <Input label="Field Label" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} required />
            {editField.is_standard ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">This is a standard field — type is fixed ({editField.type}). You can rename it and change its visibility/mandatory setting.</p>
            ) : (
              <>
                <Select label="Field Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  <option value="text">Text (Single Line)</option>
                  <option value="number">Number</option>
                  <option value="tel">Phone Number</option>
                  <option value="email">Email</option>
                  <option value="select">Dropdown (Select)</option>
                </Select>
                {editForm.type === "select" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Dropdown Options</label>
                    <textarea value={editForm.options} onChange={(e) => setEditForm({ ...editForm, options: e.target.value })} rows={4}
                      className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
                    <p className="mt-1 text-xs text-gray-400">One choice per line.</p>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-6">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editForm.is_enabled} onChange={(e) => setEditForm({ ...editForm, is_enabled: e.target.checked })} /><span className="text-sm">Enabled</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editForm.is_mandatory} onChange={(e) => setEditForm({ ...editForm, is_mandatory: e.target.checked })} /><span className="text-sm">Mandatory</span></label>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setEditField(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <Button type="submit" loading={saving}>Save Field</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
