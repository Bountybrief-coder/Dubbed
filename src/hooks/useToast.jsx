import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);
let idc = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", ttl = 3800) => {
      const id = ++idc;
      setToasts((t) => [...t, { id, message, type }]);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const api = {
    toast: push,
    success: (m, ttl) => push(m, "success", ttl),
    error: (m, ttl) => push(m, "error", ttl),
    info: (m, ttl) => push(m, "info", ttl)
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toastWrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toastIcon">
              {t.type === "success" ? <CheckCircle2 size={17} /> : t.type === "error" ? <AlertTriangle size={17} /> : <Info size={17} />}
            </span>
            <span className="toastMsg">{t.message}</span>
            <button className="toastX" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};
