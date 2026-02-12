import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from '../../store';
import { createLogger } from '../../utils/logger';

const log = createLogger('ui/auth');
const API_BASE = import.meta.env.VITE_API_BASE || '/v1';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isNetworkError = (error: unknown) => error instanceof TypeError;

const describeResponseError = async (res: Response, fallback: string) => {
  const payload = await res.json().catch(() => ({}));
  if (payload?.error) return payload.error as string;
  if (res.status === 404) {
    return 'Auth endpoint not found. Check VITE_API_BASE or the dev proxy.';
  }
  return `${fallback} (HTTP ${res.status}).`;
};

const describeFetchError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    if (isNetworkError(error) || error.message === 'Failed to fetch') {
      return 'Cannot reach auth server. Start the backend and check VITE_API_BASE/proxy.';
    }
    return error.message || fallback;
  }
  return fallback;
};

export const AuthOverlay = ({ showButton = true }: { showButton?: boolean }) => {
  const { auth, authUi, setAuthState, clearAuthState, setAuthUi } = useStore((s) => ({
    auth: s.auth,
    authUi: s.authUi,
    setAuthState: s.setAuthState,
    clearAuthState: s.clearAuthState,
    setAuthUi: s.setAuthUi
  }), shallow);

  const [email, setEmail] = useState(auth.lastEmail || '');
  const [flowState, setFlowState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const handledMagicRef = useRef(false);
  const pendingMagicRef = useRef<{ email: string; token: string } | null>(null);

  useEffect(() => {
    if (auth.lastEmail) setEmail(auth.lastEmail);
  }, [auth.lastEmail]);

  const verifyMagicLink = useCallback(async (magicEmail: string, magicToken: string) => {
    // Use AbortController to cancel the request if component unmounts
    const abortController = new AbortController();

    // Store abort controller so we can cancel it on unmount
    const verificationRef = { abortController, isMounted: true };

    try {
      setAuthUi({ modalOpen: true, sidebarOpen: false });
      setFlowState('verifying');
      setError(null);

      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          email: magicEmail,
          magic_token: magicToken
        })
      });

      // Check if component is still mounted before state updates
      if (!verificationRef.isMounted) return;

      if (!res.ok) {
        throw new Error(await describeResponseError(res, 'Verification failed.'));
      }

      const payload = await res.json();

      // Check again before state updates
      if (!verificationRef.isMounted) return;

      setAuthState({
        status: 'signed_in',
        user: payload.user
          ? { id: payload.user.id, email: payload.user.email, displayName: payload.user.display_name ?? null }
          : null,
        accessToken: payload.access_token,
        accessExpiresAt: payload.access_expires_at,
        lastEmail: normalizeEmail(magicEmail)
      });
      setAuthUi({ modalOpen: false });
      setFlowState('idle');
      pendingMagicRef.current = null;

      const url = new URL(window.location.href);
      url.searchParams.delete('magic_token');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
    } catch (e: any) {
      // Ignore abort errors - component was unmounted
      if (e.name === 'AbortError') {
        log.info('Magic link verification cancelled due to component unmount');
        return;
      }

      // Only update state if component is still mounted
      if (verificationRef.isMounted) {
        log.warn('Magic link verification failed', e);
        setFlowState('error');
        setError(describeFetchError(e, 'Verification failed.'));
      }
    } finally {
      // Mark as no longer mounted
      verificationRef.isMounted = false;
    }

    // Return cleanup function
    return () => {
      verificationRef.isMounted = false;
      abortController.abort();
    };
  }, [setAuthState, setAuthUi]);

  useEffect(() => {
    if (handledMagicRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get('magic_token');
    const magicEmail = params.get('email');
    if (!magicToken || !magicEmail) return;
    pendingMagicRef.current = { email: magicEmail, token: magicToken };
    handledMagicRef.current = true;
    const tokenKey = `magic_login_${magicToken}`;
    try {
      if (sessionStorage.getItem(tokenKey) === '1') return;
      sessionStorage.setItem(tokenKey, '1');
    } catch {
      // ignore storage access issues
    }

    verifyMagicLink(magicEmail, magicToken);
  }, [setAuthUi, verifyMagicLink]);

  const isSignedIn = auth.status === 'signed_in' && !!auth.user?.email;
  const userLabel = auth.user?.displayName || auth.user?.email || 'Account';
  const accessExpiryLabel = useMemo(() => {
    if (!auth.accessExpiresAt) return 'Unknown';
    return new Date(auth.accessExpiresAt * 1000).toLocaleString();
  }, [auth.accessExpiresAt]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) {
      setFlowState('error');
      setError('Enter a valid email address.');
      return;
    }
    setFlowState('sending');
    setError(null);
    setMagicLink(null);
    try {
      const res = await fetch(`${API_BASE}/auth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalized })
      });
      if (!res.ok) {
        throw new Error(await describeResponseError(res, 'Failed to send sign-in link.'));
      }
      const payload = await res.json().catch(() => ({}));
      if (payload?.magic_link) {
        setMagicLink(String(payload.magic_link));
      }
      setAuthState({
        status: 'signing_in',
        user: null,
        accessToken: null,
        accessExpiresAt: null,
        lastEmail: normalized
      });
      setFlowState('sent');
    } catch (e: any) {
      log.warn('Sign in start failed', e);
      setFlowState('error');
      setError(describeFetchError(e, 'Failed to send sign-in link.'));
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      log.warn('Logout failed', e);
    } finally {
      clearAuthState();
      setAuthUi({ sidebarOpen: false });
    }
  };

  const canRetryVerify = flowState === 'error' && !!pendingMagicRef.current;

  return (
    <>
      {showButton && (
        <div
          className="fixed top-0 right-0 z-[900] pointer-events-none"
          style={{
            paddingTop: 'max(12px, env(safe-area-inset-top) + 12px)',
            paddingRight: 'max(12px, env(safe-area-inset-right) + 12px)'
          }}
        >
          <div className="pointer-events-auto">
            <button
              onClick={() => (isSignedIn ? setAuthUi({ sidebarOpen: true }) : setAuthUi({ modalOpen: true }))}
              className="px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 bg-black/70 text-white border-white/20 hover:border-white/40"
            >
              {isSignedIn ? userLabel : 'Sign in'}
            </button>
          </div>
        </div>
      )}

      {authUi.modalOpen && (
        <div className="fixed inset-0 z-[950] pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (flowState === 'verifying') return;
              setAuthUi({ modalOpen: false });
              setFlowState('idle');
              setError(null);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-950 text-white shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="text-xs font-black uppercase tracking-widest">Sign in</div>
                <button
                  onClick={() => {
                    if (flowState === 'verifying') return;
                    setAuthUi({ modalOpen: false });
                    setFlowState('idle');
                    setError(null);
                  }}
                  className="min-h-[36px] min-w-[36px] px-3 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 active:scale-95"
                >
                  Close
                </button>
              </div>
              <div className="p-4">
                {flowState === 'verifying' ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold">Verifying magic link...</div>
                    <p className="text-xs text-gray-400">Hang tight, this should only take a second.</p>
                  </div>
                ) : flowState === 'sent' ? (
                  <div className="flex flex-col gap-3">
                    <div className="text-sm font-semibold">
                      {magicLink ? 'Magic link ready.' : 'Check your email.'}
                    </div>
                    <p className="text-xs text-gray-400">
                      {magicLink
                        ? 'SMTP is not configured, so use the magic link below to finish signing in.'
                        : <>We sent a sign-in link to <span className="text-white">{auth.lastEmail}</span>.</>}
                    </p>
                    {magicLink ? (
                      <div className="rounded-lg border border-gray-700 bg-black/40 p-2 text-[11px] text-gray-200 break-all">
                        {magicLink}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500">Open the link to finish signing in.</p>
                    )}
                    {magicLink && (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => { window.location.href = magicLink; }}
                          className="px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/80 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                        >
                          Open magic link
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(magicLink);
                            } catch {
                              // ignore clipboard failures
                            }
                          }}
                          className="px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 active:scale-95"
                        >
                          Copy magic link
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setFlowState('idle');
                        setError(null);
                        setMagicLink(null);
                      }}
                      className="mt-2 px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 active:scale-95"
                    >
                      Use a different email
                    </button>
                  </div>
                ) : (
                  <form className="flex flex-col gap-3" onSubmit={handleStart}>
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                    {error && (
                      <div className="text-[11px] text-red-300">{error}</div>
                    )}
                    <button
                      type="submit"
                      disabled={flowState === 'sending'}
                      className="mt-1 px-3 py-2 rounded-xl border border-blue-500 bg-blue-600 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all disabled:opacity-60"
                    >
                      {flowState === 'sending' ? 'Sending...' : 'Send sign-in link'}
                    </button>
                    {canRetryVerify && (
                      <button
                        type="button"
                        onClick={() => {
                          const pending = pendingMagicRef.current;
                          if (!pending) return;
                          verifyMagicLink(pending.email, pending.token);
                        }}
                        className="mt-2 px-3 py-2 rounded-xl border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 active:scale-95"
                      >
                        Retry verification
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {authUi.sidebarOpen && (
        <div className="fixed inset-0 z-[940] pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAuthUi({ sidebarOpen: false })}
          />
          <div className="absolute top-0 right-0 h-full w-[min(320px,92vw)] bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col">
            <div
              className="flex items-center justify-between px-4 py-4 border-b border-gray-800"
              style={{ paddingTop: 'max(16px, env(safe-area-inset-top) + 16px)' }}
            >
              <div className="text-xs font-black uppercase tracking-widest text-gray-200">Account</div>
              <button
                onClick={() => setAuthUi({ sidebarOpen: false })}
                className="min-h-[36px] min-w-[36px] px-3 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 active:scale-95"
              >
                Close
              </button>
            </div>
            <div className="flex-1 px-4 py-4 flex flex-col gap-3 text-sm text-gray-200">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Signed in as</div>
                <div className="text-sm font-semibold">{auth.user?.email || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Access token expires</div>
                <div className="text-xs text-gray-400">{accessExpiryLabel}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="mt-2 px-3 py-2 rounded-xl border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-gray-500 active:scale-95"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
