import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // Optionally send to logging endpoint
    // fetch('/api/log', { method: 'POST', body: JSON.stringify({ error: String(error), stack: info?.componentStack }) });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const err = this.state.error;
    const stack = this.state.info?.componentStack || err.stack || '';

    return (
      <div style={{ padding: 20, fontFamily: 'monospace', color: '#d8e8ff', background: '#010409', minHeight: '100vh' }}>
        <h2 style={{ color: '#ff6b6b' }}>Application error</h2>
        <div style={{ marginTop: 12, color: '#d8e8ff' }}>
          <div><strong>Error:</strong> {String(err)}</div>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, color: '#ffa8a8' }}>{stack}</pre>
        </div>
      </div>
    );
  }
}
