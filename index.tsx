import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { MobileErrorBoundary } from './components/mobile/MobileErrorBoundary';
import { createLogger } from './utils/logger';
import { resetPersistedState } from './store/logic/storageKeys';
import { initMobileStability } from './utils/mobileStability';
import { buildDiagnosticsPackage } from './utils/diagnostics';
import { copyJsonToClipboard, downloadJson } from './utils/download';

type AppComponent = React.ComponentType;

const log = createLogger('boot');

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  constructor(props: any) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error: any) {
    return { err: error };
  }
  componentDidCatch(error: any) {
    log.error('App render error', error);
  }
  render() {
    if (this.state.err) {
      return <FatalScreen error={this.state.err} />;
    }
    return this.props.children;
  }
}

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function stringifyError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    return `${err.name}: ${err.message}${err.stack ? `\n\n${err.stack}` : ''}`;
  }
  if (typeof err === 'object') {
    const name = (err as any).name ? String((err as any).name) : 'Error';
    const msg = (err as any).message ? String((err as any).message) : '';
    const stack = (err as any).stack ? String((err as any).stack) : '';
    const extra = safeStringify(err);
    return `${name}${msg ? `: ${msg}` : ''}${stack ? `\n\n${stack}` : ''}${extra ? `\n\n${extra}` : ''}`;
  }
  return String(err);
}

function FatalScreen({ error }: { error: any }) {
  const text = useMemo(() => stringifyError(error), [error]);

  const reset = () => {
    try {
      resetPersistedState();
    } catch {
      
    }
    window.location.reload();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050505',
        color: '#fff',
        padding: 20,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>
          App failed to start
        </h1>
        <p style={{ color: '#bbb', lineHeight: 1.6, marginBottom: 16 }}>
          常见原因：启动时报错、或旧版本的 localStorage 导致进入“无法渲染的组合状态”。
          先点 <b>Reset saved state</b>，大多数黑屏会立刻恢复。
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            onClick={reset}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset saved state
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(text)}
            style={{
              background: '#111827',
              border: '1px solid #374151',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Copy error details
          </button>
          <button
            onClick={() => copyJsonToClipboard(buildDiagnosticsPackage())}
            style={{
              background: '#0f172a',
              border: '1px solid #374151',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Copy diagnostics
          </button>
          <button
            onClick={() => downloadJson(`diagnostics-${Date.now()}.json`, buildDiagnosticsPackage())}
            style={{
              background: '#0b1220',
              border: '1px solid #374151',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Download diagnostics
          </button>
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
          If the issue persists, export diagnostics and include them when reporting the bug.
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#0b0b0b',
            border: '1px solid #222',
            borderRadius: 14,
            padding: 14,
            lineHeight: 1.5,
            color: '#e5e7eb',
          }}
        >
          {text}
        </pre>
      </div>
    </div>
  );
}

function Boot() {
  const [err, setErr] = useState<any>(null);

  useEffect(() => {
    const dispose = initMobileStability({
      onFatal: (error) => setErr(error)
    });
    return () => {
      dispose?.();
    };
  }, []);

  if (err) return <FatalScreen error={err} />;
  return <App />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  
  document.body.style.background = '#050505';
  document.body.style.color = '#fff';
  document.body.style.fontFamily = 'ui-monospace, monospace';
  document.body.textContent = 'Fatal: could not find #root element.';
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <MobileErrorBoundary>
        <Boot />
      </MobileErrorBoundary>
    </AppErrorBoundary>
  </React.StrictMode>
);
