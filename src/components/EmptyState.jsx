import React from "react";

// Intentional empty state — not an error, just "nothing here yet".
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="emptyState2">
      {Icon && <div className="emptyIcon"><Icon size={26} /></div>}
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
