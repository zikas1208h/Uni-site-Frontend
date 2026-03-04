import React, { useState, useRef } from 'react';
import { authAPI } from '../services/api';
import './SetupCredentials.css';

/**
 * Full-screen modal shown to staff users who have mustChangeCredentials=true.
 * Flow:  Step 1 → enter new email
 *        Step 2 → enter OTP sent to that email
 *        Step 3 → choose new password
 *        Done   → parent gets fresh token + user
 */
const SetupCredentials = ({ user, onComplete }) => {
  const [step, setStep]           = useState(1); // 1 | 2 | 3 | 'done'
  const [newEmail, setNewEmail]   = useState('');
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [verifyToken, setVerifyToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [info, setInfo]           = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  // ── password strength ────────────────────────────────────────────────────
  const pwStrength = (() => {
    if (!newPassword) return { score: 0, label: '' };
    let s = 0;
    if (newPassword.length >= 8)  s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    if (s <= 1) return { score: s, label: 'Weak',   color: '#ef4444' };
    if (s <= 3) return { score: s, label: 'Fair',   color: '#f59e0b' };
    if (s <= 4) return { score: s, label: 'Good',   color: '#22c55e' };
    return              { score: s, label: 'Strong', color: '#6366f1' };
  })();

  // ── Step 1: send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!newEmail) return setError('Please enter your email address.');
    setLoading(true);
    try {
      const r = await authAPI.sendOtp(newEmail);
      setInfo(r.data.message);
      setStep(2);
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send code. Try again.');
    } finally { setLoading(false); }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const iv = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(''); setInfo('');
    setLoading(true);
    try {
      const r = await authAPI.sendOtp(newEmail);
      setInfo(r.data.message);
      setOtp(['', '', '', '', '', '']);
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally { setLoading(false); }
  };

  // ── OTP input helpers ────────────────────────────────────────────────────
  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return setError('Please enter the full 6-digit code.');
    setError(''); setLoading(true);
    try {
      const r = await authAPI.verifyOtp(code);
      setVerifyToken(r.data.verifyToken);
      setInfo('');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Try again.');
    } finally { setLoading(false); }
  };

  // ── Step 3: set new password ─────────────────────────────────────────────
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirmPass) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const r = await authAPI.setupCredentials({ newEmail, newPassword, verifyToken });
      setStep('done');
      // Give the success animation a moment then hand control back
      setTimeout(() => onComplete(r.data.token, r.data.user), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update credentials.');
    } finally { setLoading(false); }
  };

  const STEPS = [
    { n: 1, label: 'New Email' },
    { n: 2, label: 'Verify'    },
    { n: 3, label: 'Password'  },
  ];

  return (
    <div className="sc-overlay">
      <div className="sc-modal">
        {/* Header */}
        <div className="sc-header">
          <div className="sc-logo">🎓</div>
          <h1>Account Setup Required</h1>
          <p>Welcome, <strong>{user?.firstName}</strong>! Set your personal email and password before continuing.</p>
        </div>

        {/* Progress */}
        {step !== 'done' && (
          <div className="sc-progress">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`sc-step ${step >= s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}>
                  <div className="sc-step-dot">{step > s.n ? '✓' : s.n}</div>
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`sc-step-line ${step > s.n ? 'done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Messages */}
        {error && <div className="sc-alert sc-alert--err">⚠️ {error}</div>}
        {info  && <div className="sc-alert sc-alert--ok">✅ {info}</div>}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form className="sc-form" onSubmit={handleSendOtp}>
            <div className="sc-field">
              <label>Your New Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
              <span className="sc-hint">Enter the email you want to use to log in going forward.</span>
            </div>
            <button type="submit" className="sc-btn" disabled={loading}>
              {loading ? <span className="sc-spinner" /> : '📧 Send Verification Code'}
            </button>
          </form>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <form className="sc-form" onSubmit={handleVerifyOtp}>
            <div className="sc-field">
              <label>Enter the 6-digit code sent to <strong>{newEmail}</strong></label>
              <div className="sc-otp-row" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    className="sc-otp-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              <button
                type="button"
                className="sc-resend"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : '🔄 Resend Code'}
              </button>
            </div>
            <div className="sc-form-row">
              <button type="button" className="sc-btn sc-btn--ghost" onClick={() => { setStep(1); setOtp(['','','','','','']); setError(''); }}>← Back</button>
              <button type="submit" className="sc-btn" disabled={loading || otp.join('').length < 6}>
                {loading ? <span className="sc-spinner" /> : '✅ Verify Code'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <form className="sc-form" onSubmit={handleSetPassword}>
            <div className="sc-field">
              <label>New Password</label>
              <div className="sc-pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  autoFocus
                />
                <button type="button" className="sc-pwd-eye" onClick={() => setShowPwd(p => !p)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              {newPassword && (
                <div className="sc-strength">
                  <div className="sc-strength-bar">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className="sc-strength-seg" style={{ background: n <= pwStrength.score ? pwStrength.color : '#e2e8f0' }} />
                    ))}
                  </div>
                  <span style={{ color: pwStrength.color, fontSize: 12, fontWeight: 700 }}>{pwStrength.label}</span>
                </div>
              )}
            </div>
            <div className="sc-field">
              <label>Confirm Password</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Re-enter password"
                required
              />
              {confirmPass && newPassword !== confirmPass && (
                <span className="sc-mismatch">Passwords don't match</span>
              )}
            </div>
            <div className="sc-form-row">
              <button type="button" className="sc-btn sc-btn--ghost" onClick={() => { setStep(2); setError(''); }}>← Back</button>
              <button type="submit" className="sc-btn" disabled={loading || newPassword !== confirmPass || newPassword.length < 8}>
                {loading ? <span className="sc-spinner" /> : '🔐 Save & Continue'}
              </button>
            </div>
          </form>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <div className="sc-done">
            <div className="sc-done-icon">🎉</div>
            <h2>All set!</h2>
            <p>Your credentials have been updated. Redirecting…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupCredentials;

