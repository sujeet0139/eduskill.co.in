"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Toast + confirm-dialog provider. Wrap the admin app once; call useToast()
// anywhere to show toasts or an async confirm() that resolves true/false.
const ToastCtx = createContext(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  // Safe fallback so components don't crash if used outside the provider.
  if (!ctx) {
    return {
      toast: (m) => (typeof window !== "undefined" ? window.alert(m) : null),
      success: (m) => (typeof window !== "undefined" ? window.alert(m) : null),
      error: (m) => (typeof window !== "undefined" ? window.alert(m) : null),
      confirm: (m) => Promise.resolve(typeof window !== "undefined" ? window.confirm(m) : false),
    };
  }
  return ctx;
}

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { message, resolve }

  const push = useCallback((message, type = "info") => {
    const id = ++idSeq;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const api = {
    toast: (m) => push(m, "info"),
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    confirm: (message) => new Promise((resolve) => setDialog({ message, resolve })),
  };

  const closeDialog = (val) => {
    if (dialog) dialog.resolve(val);
    setDialog(null);
  };

  const styles = {
    info: "bg-gray-900 text-white",
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto min-w-[240px] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ${styles[t.type]}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => closeDialog(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-800">{dialog.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => closeDialog(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={() => closeDialog(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
