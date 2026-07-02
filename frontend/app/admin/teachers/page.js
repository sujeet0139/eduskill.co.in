"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY_FORM = {
  name: "",
  subject: "",
  expertise: "",
  qualification: "",
  experience: "",
  mobile: "",
  email: "",
  gender: "Male",
  dob: "",
  address: "",
  available_time: "",
  joining_date: "",
  class_timing: "",
  remarks: "",
  status: "Active"
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const token = () => adminAuth.token();
  const notify = useToast();

  // Set / generate a teacher's portal login password.
  const setPassword = async (t) => {
    const entered = window.prompt(`Set a login password for ${t.name} (leave blank to auto-generate):`, "");
    if (entered === null) return; // cancelled
    try {
      const res = await api.put(`/api/teachers/${t.id}/set-password`, entered ? { password: entered } : {}, token());
      const pwd = res.password || entered;
      window.prompt(`Password set for ${t.email}. Copy & share it with the teacher:`, pwd);
    } catch (e) { notify.error(e.message); }
  };

  // Load teachers from backend API
  const load = () => {
    setLoading(true);
    setError("");
    const queryParams = `?page=${page}&limit=10&q=${encodeURIComponent(q)}&status=${statusFilter}`;
    
    api.get(`/api/teachers${queryParams}`, token())
      .then((d) => {
        setTeachers(d.teachers || []);
        if (d.pagination) {
          setPagination(d.pagination);
        }
      })
      .catch((e) => setError(e.message || "Failed to load teachers."))
      .finally(() => setLoading(false));
  };

  // Reload data when filters/page changes
  useEffect(() => {
    load();
  }, [page, statusFilter]);

  // Handle keypress/debounced or manual search trigger
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    load();
  };

  // Form input change handlers
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const fileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  // Open modals
  const openNew = () => {
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setEditId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (t) => {
    // Format dates to YYYY-MM-DD for input fields
    const formattedDob = t.dob ? t.dob.split("T")[0] : "";
    const formattedJoining = t.joining_date ? t.joining_date.split("T")[0] : "";

    setForm({
      name: t.name || "",
      subject: t.subject || "",
      expertise: t.expertise || "",
      qualification: t.qualification || "",
      experience: t.experience || "",
      mobile: t.mobile || "",
      email: t.email || "",
      gender: t.gender || "Male",
      dob: formattedDob,
      address: t.address || "",
      available_time: t.available_time || "",
      joining_date: formattedJoining,
      class_timing: t.class_timing || "",
      remarks: t.remarks || "",
      status: t.status || "Active"
    });
    setPhotoFile(null);
    setEditId(t.id);
    setFormError("");
    setModalOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    if (!form.name.trim()) return "Full Name is required.";
    if (!form.email.trim()) return "Email ID is required.";
    if (!form.mobile.trim()) return "Mobile Number is required.";
    
    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      return "Invalid Email ID format.";
    }

    // Phone format validation (simple digits check)
    const phoneDigits = form.mobile.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return "Mobile Number must be at least 10 digits.";
    }

    return null;
  };

  // Save/Update Teacher
  const save = async (e) => {
    e.preventDefault();
    setFormError("");
    
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);

    try {
      // Build FormData for upload
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== undefined && form[key] !== null) {
          formData.append(key, form[key]);
        }
      });

      if (photoFile) {
        formData.append("profile_photo", photoFile);
      }

      if (editId) {
        await api.putForm(`/api/teachers/${editId}`, formData, token());
      } else {
        await api.postForm("/api/teachers", formData, token());
      }

      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message || "Failed to save teacher details.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Teacher
  const remove = async (id) => {
    if (!(await notify.confirm("Are you sure you want to delete this teacher? This action cannot be undone."))) return;
    try {
      await api.del(`/api/teachers/${id}`, token());
      load();
    } catch (err) {
      notify.error(err.message || "Failed to delete teacher.");
    }
  };

  return (
    <>
      <PageHeader
        title="Teacher Management"
        subtitle={`${pagination.total} teachers registered`}
        action={<Button onClick={openNew}>+ Register Teacher</Button>}
      />

      {/* SEARCH AND FILTERS */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm md:flex-row md:items-center">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search by name, subject, email, mobile, or ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
          <Button type="submit">Search</Button>
        </form>
        
        <div className="w-full md:w-48">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* TEACHERS LIST TABLE */}
      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Photo</Th>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Subject</Th>
            <Th>Email / Mobile</Th>
            <Th>Qualification / Exp</Th>
            <Th>Timing</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr>
              <Td colSpan="9" className="text-center py-8 text-gray-500">Loading teachers...</Td>
            </tr>
          ) : teachers.length === 0 ? (
            <tr>
              <Td colSpan="9" className="text-center py-8 text-gray-500">No teachers found.</Td>
            </tr>
          ) : (
            teachers.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <Td>
                  {t.profile_photo ? (
                    <img
                      src={t.profile_photo.startsWith("http") ? t.profile_photo : `${api.base}${t.profile_photo}`}
                      alt={t.name}
                      className="h-10 w-10 rounded-full object-cover border border-gray-200"
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&auto=format&fit=crop&q=60"; }}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                      {t.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </Td>
                <Td className="font-mono text-xs font-semibold">{t.teacher_id}</Td>
                <Td className="font-medium text-gray-900">{t.name}</Td>
                <Td>{t.subject || "—"}</Td>
                <Td>
                  <div className="text-xs">
                    <p className="text-gray-900">{t.email}</p>
                    <p className="text-gray-500 font-mono">{t.mobile}</p>
                  </div>
                </Td>
                <Td>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">{t.qualification || "—"}</p>
                    <p className="text-gray-500">{t.experience ? `${t.experience} exp` : "—"}</p>
                  </div>
                </Td>
                <Td className="text-xs">
                  {t.class_timing ? (
                    <div>
                      <p className="text-gray-900">{t.class_timing}</p>
                      <p className="text-gray-500 italic text-[10px]">{t.available_time || "available"}</p>
                    </div>
                  ) : (
                    t.available_time || "—"
                  )}
                </Td>
                <Td>
                  <StatusBadge status={t.status.toLowerCase()} />
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPassword(t)}
                      className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200"
                    >
                      Password
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      {/* PAGINATION CONTROLS */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:bg-gray-100"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, pagination.pages))}
              disabled={page === pagination.pages}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* REGISTRATION AND EDIT MODAL */}
      <Modal
        open={modalOpen}
        title={editId ? `Edit Teacher Details (${form.name})` : "Register New Teacher"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={save} className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              name="name"
              value={form.name}
              onChange={change}
              required
            />
            <Input
              label="Email ID *"
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Mobile Number *"
              type="tel"
              name="mobile"
              value={form.mobile}
              onChange={change}
              required
            />
            <Select
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={change}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              name="dob"
              value={form.dob}
              onChange={change}
            />
            <Input
              label="Joining Date"
              type="date"
              name="joining_date"
              value={form.joining_date}
              onChange={change}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Subject / Domain"
              name="subject"
              placeholder="e.g. Computer Science"
              value={form.subject}
              onChange={change}
            />
            <Input
              label="Qualification"
              name="qualification"
              placeholder="e.g. M.Tech, Ph.D"
              value={form.qualification}
              onChange={change}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Experience"
              name="experience"
              placeholder="e.g. 5 Years"
              value={form.experience}
              onChange={change}
            />
            <Input
              label="Available Time for Class"
              name="available_time"
              placeholder="e.g. Mon-Fri 10AM-2PM"
              value={form.available_time}
              onChange={change}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Class Timing"
              name="class_timing"
              placeholder="e.g. 11:00 AM - 12:00 PM"
              value={form.class_timing}
              onChange={change}
            />
            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={change}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>

          <Input
            label="Topic / Area of Expertise"
            name="expertise"
            placeholder="e.g. Web Development, DBMS, AI"
            value={form.expertise}
            onChange={change}
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Address</span>
            <textarea
              name="address"
              value={form.address}
              onChange={change}
              rows={2}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none text-sm"
              placeholder="Full mailing address..."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Remarks / Notes</span>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={change}
              rows={2}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none text-sm"
              placeholder="Additional admin notes..."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Profile Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={fileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
            />
          </label>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full text-sm py-2.5">
              {editId ? "Update Teacher" : "Register Teacher"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
