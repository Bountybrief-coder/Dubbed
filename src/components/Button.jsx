import React from "react";
import { Spinner } from "./Spinner";

// Variants: primary | ghost | danger | subtle. `loading` disables + shows spinner.
export function Button({ variant = "primary", loading, disabled, children, className = "", ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : children}
    </button>
  );
}
