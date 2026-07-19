import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Accessible modal with enter/exit transition (CSS handles the animation via
// the .modalCard mount). Closes on Escape and backdrop click. Traps focus
// inside the dialog while open and restores focus on close.
export function Modal({ open, onClose, title, eyebrow, children, size = "md" }) {
  const cardRef = useRef(null);
  const prevFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    prevFocusRef.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const timer = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const first = card.querySelector(FOCUSABLE);
      if (first) first.focus();
      else card.focus();
    });

    function onKey(e) {
      if (e.key === "Escape") {
        onCloseRef.current?.();
        return;
      }

      if (e.key === "Tab") {
        const card = cardRef.current;
        if (!card) return;
        const nodes = card.querySelectorAll(FOCUSABLE);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === "function") {
        prevFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <section
        ref={cardRef}
        className={`modalCard modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <button className="modalClose" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className="modalTitle">{title}</h2>}
        {children}
      </section>
    </div>
  );
}
