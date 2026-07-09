import React, { useEffect } from "react";
import { X } from "lucide-react";

// Accessible modal with enter/exit transition (CSS handles the animation via
// the .modalCard mount). Closes on Escape and backdrop click.
export function Modal({ open, onClose, title, eyebrow, children, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <section className={`modalCard modal-${size}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modalClose" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className="modalTitle">{title}</h2>}
        {children}
      </section>
    </div>
  );
}
