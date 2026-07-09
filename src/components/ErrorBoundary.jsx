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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="errorBoundary">
          <AlertTriangle size={36} />
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Try reloading the page.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
