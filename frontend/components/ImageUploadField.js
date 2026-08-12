"use client";

import { useState } from "react";
import { api } from "@/lib/api";

// Shared image upload widget (dev-prompt item #25 -- "reuse the same upload
// component for course/banner images in the admin course screens").
// Two modes, so this one component fits every image-upload spot in the
// admin panel without forcing a backend change on the ones that don't need it:
//   - Immediate mode (pass `uploadUrl` + `token`): uploads as soon as a file
//     is chosen, calls onUploaded(url) with the stored URL. Used where the
//     form already works by storing a URL string (course image, college
//     logo, student photo).
//   - Deferred mode (omit `uploadUrl`): just hands the raw File back via
//     onFileSelected(file) for the parent to bundle into its own multipart
//     submit. Used where a screen already uploads the image together with
//     the rest of the form (hero slides).
export function ImageUploadField({
  label, previewUrl, uploadUrl, token, fieldName = "image",
  onUploaded, onFileSelected,
  accept = "image/*", hint,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!uploadUrl) {
      onFileSelected && onFileSelected(file);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append(fieldName, file);
      const res = await api.postForm(uploadUrl, fd, token);
      onUploaded && onUploaded(res.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <input
        type="file" accept={accept} disabled={uploading} onChange={handleChange}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {uploading && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {previewUrl && !uploading && (
        <img src={api.mediaUrl(previewUrl)} alt="" className="mt-2 h-16 w-16 rounded border object-contain p-1" />
      )}
    </div>
  );
}
