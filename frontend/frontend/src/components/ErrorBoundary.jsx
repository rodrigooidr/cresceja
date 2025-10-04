// src/components/ErrorBoundary.jsx
import React from 'react';
export default class ErrorBoundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err, info){ console.error('ErrorBoundary', err, info); }
  render(){
    if (!this.state.err) return this.props.children;
    return (
      <div style={{padding:16}}>
        <h2 style={{color:'#b91c1c'}}>Algo deu errado</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.err?.message || this.state.err)}</pre>
      </div>
    );
  }
}
