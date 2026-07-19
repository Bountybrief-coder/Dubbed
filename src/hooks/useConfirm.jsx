import React, { useState, useCallback, useRef } from "react";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";

let globalShow = null;

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  globalShow = useCallback(({ title, message, confirmLabel, variant }) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ title, message, confirmLabel: confirmLabel || "Confirm", variant: variant || "danger" });
    });
  }, []);

  function handleClose(result) {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }

  return (
    <>
      {children}
      {state && (
        <Modal open onClose={() => handleClose(false)} size="sm">
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{state.title || "Are you sure?"}</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{state.message}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
            <Button variant={state.variant} size="sm" onClick={() => handleClose(true)}>{state.confirmLabel}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function useConfirm() {
  return useCallback((opts) => {
    if (typeof opts === "string") opts = { message: opts };
    return globalShow(opts);
  }, []);
}
