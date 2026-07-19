import React from "react";
import { Spinner } from "./Spinner";

// Variants: primary | ghost | danger | subtle. `loading` disables + shows spinner.
export function Button({ variant = "primary", loading, disabled, children, className = "", size, icon: Icon, type = "button", ...rest }) {
  const sizeClass = size === "sm" ? "sm" : size === "lg" ? "lg" : "";
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : <>{Icon && <Icon size={size === "sm" ? 13 : 16} />}{children}</>}
    </button>
  );
}
