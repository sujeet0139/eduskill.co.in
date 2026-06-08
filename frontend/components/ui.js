"use client";

export function Alert({ type = "info", children }) {
  if (!children) return null;
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>
  );
}

export function Button({ children, loading, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-dark disabled:bg-gray-400 ${className}`}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function Input({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}
      <input
        {...props}
        className={`w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none ${className}`}
      />
    </label>
  );
}

export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}
      <select
        {...props}
        className={`w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand focus:outline-none ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-xl bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function StatusBadge({ status }) {
  const map = {
    registered: "bg-amber-100 text-amber-800",
    verified: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    revoked: "bg-red-100 text-red-800",
    draft: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status || "—"}
    </span>
  );
}
