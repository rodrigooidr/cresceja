import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('UI ErrorBoundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold mb-2">Algo deu errado</h1>
          <p className="text-sm text-gray-600">Tente recarregar a página. Se persistir, fale com o suporte.</p>
        </div>
      );
    }
    return this.props.children;
  }
}