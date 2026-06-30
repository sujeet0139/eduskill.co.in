"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader } from "@/components/admin";
import { Card, Input, Button, Alert } from "@/components/ui";

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/api/settings", adminAuth.token());
        setSettings(res.settings || {});
      } catch (err) {
        setError("Failed to load settings: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put("/api/settings", settings, adminAuth.token());
      setSuccess("Settings saved successfully!");
    } catch (err) {
      setError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <>
      <PageHeader title="System Settings" subtitle="Configure general application settings." />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* Institute Details */}
        <Card>
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">Institute Details</h3>
          <div className="space-y-4">
            <Input label="Institute Name" name="institute_name" value={settings.institute_name || ""} onChange={handleChange} />
            <Input label="Website URL" name="institute_website" value={settings.institute_website || ""} onChange={handleChange} placeholder="https://example.com" />
            <Input label="Contact Email" name="institute_email" value={settings.institute_email || ""} onChange={handleChange} type="email" />
            <Input label="Contact Phone" name="institute_phone" value={settings.institute_phone || ""} onChange={handleChange} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Institute Address</span>
              <textarea name="institute_address" value={settings.institute_address || ""} onChange={handleChange} rows="3" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
            </label>
          </div>
        </Card>

        {/* Payment Settings */}
        <Card>
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">Payment Settings</h3>
          <div className="space-y-4">
            <Input label="UPI ID" name="payment_upi_id" value={settings.payment_upi_id || ""} onChange={handleChange} placeholder="your-upi@okhdfcbank" />
            <Input label="UPI QR Code Image URL" name="payment_upi_qr_url" value={settings.payment_upi_qr_url || ""} onChange={handleChange} placeholder="URL to the QR code image" />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Bank Account Details</span>
              <textarea name="payment_bank_details" value={settings.payment_bank_details || ""} onChange={handleChange} rows="4" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" placeholder="Bank Name: ...&#10;Account No: ...&#10;IFSC: ..." />
            </label>
          </div>
        </Card>

        {/* Email SMTP Settings */}
        <Card>
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">Email (SMTP) Settings</h3>
          <p className="text-xs text-gray-500 mb-4">These credentials are used to send all system emails (welcome, reminders, etc.). They are stored securely.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="SMTP Host" name="smtp_host" value={settings.smtp_host || ""} onChange={handleChange} />
            <Input label="SMTP Port" name="smtp_port" value={settings.smtp_port || ""} onChange={handleChange} type="number" />
            <Input label="SMTP User" name="smtp_user" value={settings.smtp_user || ""} onChange={handleChange} />
            <Input label="SMTP Password" name="smtp_password" value={settings.smtp_password || ""} onChange={handleChange} type="password" placeholder="••••••••" />
            <Input label="Sender Name" name="smtp_from_name" value={settings.smtp_from_name || ""} onChange={handleChange} placeholder="EduSkill" />
            <Input label="Sender Email" name="smtp_from_email" value={settings.smtp_from_email || ""} onChange={handleChange} type="email" placeholder="noreply@eduskill.co.in" />
          </div>
        </Card>

        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" loading={saving}>
            Save All Settings
          </Button>
        </div>
      </form>
    </>
  );
}