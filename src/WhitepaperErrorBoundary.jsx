import React from 'react';

export class WhitepaperErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[UniTorch] Whitepaper render failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl p-8 font-mono text-sm text-red-400">
          <p className="mb-4 text-fluor">Failed to load UniTorch docs.</p>
          <pre className="overflow-x-auto whitespace-pre-wrap border border-zinc-800 bg-black p-4 text-xs text-zinc-300">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-6 border border-fluor px-4 py-2 text-xs uppercase tracking-widest text-fluor"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
