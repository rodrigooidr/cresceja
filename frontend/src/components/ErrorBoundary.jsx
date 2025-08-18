import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error('ErrorBoundary', err, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-red-700">Algo deu errado</h1>
          <p className="text-sm text-gray-600 mt-2">Cheque o console para detalhes.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
