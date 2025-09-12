import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    // opcional: reportar para Sentry etc.
    // console.error("ErrorBoundary caught:", err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Erro de renderização</div>
          <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}>
            {String(this.state.err?.message || this.state.err)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
