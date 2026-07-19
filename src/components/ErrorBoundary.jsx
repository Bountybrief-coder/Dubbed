import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    if (error?.message?.includes("dynamically imported module") || error?.message?.includes("Failed to fetch")) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "An unexpected error occurred.";
      return (
        <div className="errorBoundary">
          <AlertTriangle size={36} />
          <h2>Something went wrong</h2>
          <p>{msg}</p>
          <button className="btn btn-primary" onClick={() => window.location.replace("/")}>
            <RefreshCw size={15} /> Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
