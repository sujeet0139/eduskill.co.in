"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader } from "@/components/admin";
import { Card, Input, Button, Alert } from "@/components/ui";
import { Building2, CreditCard, Mail, Save, Check, AlertCircle, Share2 } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("institute");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [changedFields, setChangedFields] = useState(new Set());

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
    setChangedFields((prev) => new Set(prev).add(name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put("/api/settings", settings, adminAuth.token());
      setSuccess("Settings saved successfully!");
      setChangedFields(new Set());
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const [qrUploading, setQrUploading] = useState(false);

  const uploadQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("qr", file);
      const res = await api.postForm("/api/settings/upload-qr", fd, adminAuth.token());
      setSettings((prev) => ({ ...prev, payment_upi_qr_url: res.url }));
      setSuccess("QR code uploaded.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("QR upload failed: " + err.message);
    } finally {
      setQrUploading(false);
    }
  };

  const tabs = [
    { id: "institute", label: "Institute Details", icon: Building2 },
    { id: "payment", label: "Payment Settings", icon: CreditCard },
    { id: "social", label: "Social Media", icon: Share2 },
    { id: "email", label: "Email (SMTP)", icon: Mail },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        title="System Settings" 
        subtitle="Configure your platform settings and preferences." 
      />

      <div className="bg-white rounded-lg shadow-sm">
        {/* Alert Messages */}
        <div className="p-6 border-b border-gray-200">
          {error && (
            <Alert type="error" className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </Alert>
          )}
          {success && (
            <Alert type="success" className="flex items-start gap-3">
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Success</p>
                <p className="text-sm">{success}</p>
              </div>
            </Alert>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-4 font-medium text-sm whitespace-nowrap transition-all border-b-2 ${
                    isActive
                      ? "text-blue-600 border-b-blue-600 bg-blue-50"
                      : "text-gray-600 border-b-transparent hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Institute Details Tab */}
          {activeTab === "institute" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Institute Name *
                  </label>
                  <Input
                    name="institute_name"
                    value={settings.institute_name || ""}
                    onChange={handleChange}
                    placeholder="EduSkill Academy"
                    className="border-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">Name displayed across your platform</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Website URL
                  </label>
                  <Input
                    name="institute_website"
                    value={settings.institute_website || ""}
                    onChange={handleChange}
                    placeholder="https://example.com"
                    type="url"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your public website</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Contact Email *
                  </label>
                  <Input
                    name="institute_email"
                    value={settings.institute_email || ""}
                    onChange={handleChange}
                    type="email"
                    placeholder="contact@eduskill.co.in"
                  />
                  <p className="text-xs text-gray-500 mt-1">For student inquiries</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Contact Phone *
                  </label>
                  <Input
                    name="institute_phone"
                    value={settings.institute_phone || ""}
                    onChange={handleChange}
                    placeholder="+91 XXXXXXXXXX"
                  />
                  <p className="text-xs text-gray-500 mt-1">Support phone number</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Institute Address
                </label>
                <textarea
                  name="institute_address"
                  value={settings.institute_address || ""}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Street Address&#10;City, State, PIN Code&#10;Country"
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium"
                />
                <p className="text-xs text-gray-500 mt-1">Displayed on certificates and official documents</p>
              </div>
            </div>
          )}

          {/* Payment Settings Tab */}
          {activeTab === "payment" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Payment Configuration</p>
                  <p>Configure your preferred payment methods for student registrations and course fees.</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  UPI Payment Method
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                    <Input
                      name="payment_upi_id"
                      value={settings.payment_upi_id || ""}
                      onChange={handleChange}
                      placeholder="yourname@okhdfcbank"
                    />
                    <p className="text-xs text-gray-500 mt-1">e.g., yourname@upi</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UPI QR Code
                    </label>
                    <Input
                      name="payment_upi_qr_url"
                      value={settings.payment_upi_qr_url || ""}
                      onChange={handleChange}
                      placeholder="https://cdn.example.com/qr-code.png"
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={uploadQr}
                        className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white" />
                      {qrUploading && <span className="text-xs text-gray-500">Uploading…</span>}
                    </div>
                    {settings.payment_upi_qr_url && (
                      <img src={settings.payment_upi_qr_url} alt="UPI QR" className="mt-3 h-32 w-32 rounded-lg border object-contain p-1" />
                    )}
                    <p className="text-xs text-gray-500 mt-1">Upload an image or paste a URL. Shown to students on the pay screen.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Bank Transfer Details
                </h4>
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Account Information
                  </label>
                  <textarea
                    name="payment_bank_details"
                    value={settings.payment_bank_details || ""}
                    onChange={handleChange}
                    rows="5"
                    placeholder="Bank Name: HDFC Bank&#10;Account Holder: EduSkill Pvt Ltd&#10;Account Number: XXXXXXXXXXXX&#10;IFSC Code: HDFC0001234&#10;Branch: New Delhi"
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Displayed to students during checkout</p>
                </div>
              </div>
            </div>
          )}

          {/* Social Media Tab */}
          {activeTab === "social" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Share2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">Social Media & Contact Links</p>
                  <p>These appear in the website footer and contact sections. Leave blank to hide.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  ["social_whatsapp", "WhatsApp Number / Link", "https://wa.me/91XXXXXXXXXX"],
                  ["social_facebook", "Facebook URL", "https://facebook.com/..."],
                  ["social_instagram", "Instagram URL", "https://instagram.com/..."],
                  ["social_youtube", "YouTube URL", "https://youtube.com/@..."],
                  ["social_linkedin", "LinkedIn URL", "https://linkedin.com/company/..."],
                  ["social_twitter", "Twitter / X URL", "https://x.com/..."],
                ].map(([name, label, ph]) => (
                  <div key={name}>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
                    <Input name={name} value={settings[name] || ""} onChange={handleChange} placeholder={ph} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {activeTab === "email" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">SMTP Configuration</p>
                  <p>These credentials send all system emails (welcome, notifications, certificates). Stored securely on your server.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    SMTP Host *
                  </label>
                  <Input
                    name="smtp_host"
                    value={settings.smtp_host || ""}
                    onChange={handleChange}
                    placeholder="smtp.gmail.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">e.g., smtp.gmail.com or smtp.zoho.com</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    SMTP Port *
                  </label>
                  <Input
                    name="smtp_port"
                    value={settings.smtp_port || ""}
                    onChange={handleChange}
                    type="number"
                    placeholder="587"
                  />
                  <p className="text-xs text-gray-500 mt-1">Usually 587 (TLS) or 465 (SSL)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    SMTP Username *
                  </label>
                  <Input
                    name="smtp_user"
                    value={settings.smtp_user || ""}
                    onChange={handleChange}
                    placeholder="your-email@gmail.com"
                    type="email"
                  />
                  <p className="text-xs text-gray-500 mt-1">SMTP authentication email</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    SMTP Password *
                  </label>
                  <Input
                    name="smtp_password"
                    value={settings.smtp_password || ""}
                    onChange={handleChange}
                    type="password"
                    placeholder="••••••••••••"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use app-specific password for Gmail</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Email Sender Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Name
                    </label>
                    <Input
                      name="smtp_from_name"
                      value={settings.smtp_from_name || ""}
                      onChange={handleChange}
                      placeholder="EduSkill Academy"
                    />
                    <p className="text-xs text-gray-500 mt-1">Name appearing in student emails</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Email
                    </label>
                    <Input
                      name="smtp_from_email"
                      value={settings.smtp_from_email || ""}
                      onChange={handleChange}
                      type="email"
                      placeholder="noreply@eduskill.co.in"
                    />
                    <p className="text-xs text-gray-500 mt-1">Should be verified with your SMTP provider</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-6 border-t mt-8">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Discard Changes
            </Button>
            <Button 
              type="submit" 
              loading={saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
