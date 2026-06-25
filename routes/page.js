"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader } from "@/components/admin";
import { Card } from "@/components/ui";

export default function EditCollegePage() {
  const router = useRouter();
  const params = useParams();
  const collegeId = params.id;

  const [formLoading, setFormLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [districts, setDistricts] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    college_code: "",
    district_id: "",
    address: "",
    contact_no: "",
    principal_details: "",
  });

  useEffect(() => {
    if (!collegeId) return;

    const fetchData = async () => {
      try {
        const [collegeRes, districtsRes] = await Promise.all([
          api.get(`/api/colleges/${collegeId}`, adminAuth.token()),
          api.get("/api/districts", adminAuth.token()),
        ]);

        const collegeData = collegeRes.data.college;
        setFormData({
          name: collegeData.name || "",
          college_code: collegeData.college_code || "",
          district_id: collegeData.district_id || "",
          address: collegeData.address || "",
          contact_no: collegeData.contact_no || "",
          principal_details: collegeData.principal_details || "",
        });
        setDistricts(districtsRes.data.districts || []);
      } catch (err) {
        setError("Failed to load college data: " + err.message);
      } finally {
        setPageLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError("");

    try {
      const payload = { ...formData };
      if (payload.district_id === "") delete payload.district_id;

      await api.put(`/api/colleges/${collegeId}`, payload, adminAuth.token());
      router.push("/admin/colleges");
    } catch (err) {
      setError(err.message);
      setFormLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/colleges" className="text-sm text-brand hover:underline">
          ← Back to Colleges
        </Link>
      </div>
      <PageHeader title="Edit College" />

      <Card className="max-w-3xl p-6">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        
        {pageLoading ? <p>Loading...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College Name *</label>
                <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College Code</label>
                <input name="college_code" value={formData.college_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
              <select required name="district_id" value={formData.district_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-md bg-white">
                <option value="">-- Select a District --</option>
                {districts.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea name="address" value={formData.address} onChange={handleChange} rows="3" className="w-full px-3 py-2 border rounded-md"></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact No.</label>
              <input name="contact_no" value={formData.contact_no} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Principal Details</label>
              <input name="principal_details" value={formData.principal_details} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>

            <div className="pt-4 border-t">
              <button type="submit" disabled={formLoading} className="px-6 py-2 bg-brand text-white rounded-md font-medium hover:bg-brand-dark disabled:opacity-50">
                {formLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}