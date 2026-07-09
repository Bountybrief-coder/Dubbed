import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import { ToastProvider } from "./hooks/useToast.jsx";
import "./styles.css";
import "./theme.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
