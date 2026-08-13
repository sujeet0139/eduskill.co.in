"use client";

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TableWrap({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

// Shared client-side pagination control (Admin UX Standard, Section A#4 --
// "every list view gets... pagination", previously only the Students list
// had this, and it was a bespoke inline implementation there). For lists
// small enough that the backend already returns everything in one response
// (Materials, Campaigns), slicing client-side here is simpler than adding
// server-side paging to those endpoints too.
export function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="rounded-lg border-2 border-gray-200 px-3 py-1 disabled:opacity-40">Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="rounded-lg border-2 border-gray-200 px-3 py-1 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function Th({ children, className = "" }) {
  return <th className={`whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600 ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</td>;
}
