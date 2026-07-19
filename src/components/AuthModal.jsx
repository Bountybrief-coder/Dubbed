import React, { useState, useRef, useEffect, useCallback } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { validateUsername, validateEmail, validatePassword } from "../utils/validation";
import { isUsernameTaken } from "../services/profileService";
import { requestPasswordReset, resendVerification } from "../services/authService";
import { US_STATES, CA_PROVINCES, isRegionRestricted } from "../utils/games";
import logoMark from "../assets/dubbed-mark-tight.png";

const SIGNUP_COUNTRIES = [
  { code: "US", label: "United States", hasStates: true },
  { code: "CA", label: "Canada", hasStates: true },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "CO", label: "Colombia" },
  { code: "AR", label: "Argentina" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Peru" },
  { code: "OTHER", label: "Other" },
];

const TURNSTILE_SITE_KEY = "0x4AAAAAAD12pBJIj49QIrA3";

function useTurnstile(containerRef, open) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(false);
  const widgetId = useRef(null);

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetId.current != null) {
      try { window.turnstile.reset(widgetId.current); } catch {}
      return;
    }
    try {
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        size: "flexible",
        callback: (t) => { setToken(t); setError(false); },
        "expired-callback": () => setToken(null),
        "error-callback": () => { setToken(null); setError(true); },
      });
    } catch (e) {
      console.warn("[turnstile] render failed:", e);
      setError(true);
    }
  }, [containerRef]);

  useEffect(() => {
    if (!open) { setToken(null); setError(false); return; }
    const interval = setInterval(() => {
      if (window.turnstile) { render(); clearInterval(interval); }
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      if (widgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [open, render]);

  return { token, error };
}

export function AuthModal({ open, onClose }) {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const turnstileRef = useRef(null);
  const { token: turnstileToken, error: turnstileError } = useTurnstile(turnstileRef, open && mode !== "reset");

  const unameErr = mode === "register" && username ? validateUsername(username) : "";

  async function handleReset() {
    setErr("");
    if (!email.trim()) return setErr("Enter your email.");
    setBusy(true);
    const res = await requestPasswordReset(email.trim());
    setBusy(false);
    if (res.error) return setErr(res.error);
    toast.success("Reset link sent! Check your email.");
    setMode("login");
  }

  function reset() {
    setErr("");
  }

  async function submit() {
    setErr("");
    if (mode === "register") {
      const ue = validateUsername(username);
      if (ue) return setErr(ue);
      const ee = validateEmail(email);
      if (ee) return setErr(ee);
      const pe = validatePassword(password);
      if (pe) return setErr(pe);
      if (!country) return setErr("Select your country.");
      const cObj = SIGNUP_COUNTRIES.find(c => c.code === country);
      if (cObj?.hasStates && !stateCode) return setErr(country === "CA" ? "Select your province." : "Select your state.");
      if (isRegionRestricted(country, stateCode)) return setErr("Cash wagering is not available in your region. You can still play XP matches.");
      setBusy(true);
      if (await isUsernameTaken(username)) {
        setBusy(false);
        return setErr("That username is already taken.");
      }
      const res = await signUp({ email, username, password, captchaToken: turnstileToken, country, stateCode: cObj?.hasStates ? stateCode : null });
      setBusy(false);
      if (res.error) return setErr(res.error);
      if (!res.data?.session) {
        toast.success("Check your email to verify your account before logging in.");
        setMode("login");
        return;
      }
      toast.success("Welcome to Dubbed.");
      onClose();
    } else {
      setBusy(true);
      const res = await signIn({ username, password, captchaToken: turnstileToken });
      setBusy(false);
      if (res.error === "email_not_confirmed") {
        setUnverifiedEmail(res.email);
        return setErr("Your email hasn't been verified yet. Check your inbox or resend the link below.");
      }
      if (res.error) return setErr(res.error);
      toast.success("Logged in.");
      onClose();
    }
  }

  function handleClose() {
    setEmail(""); setUsername(""); setPassword(""); setCountry(""); setStateCode(""); setErr(""); setBusy(false); setMode("login"); setUnverifiedEmail("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <div className="authHead">
        <img src={logoMark} alt="Dubbed" />
        <b>{mode === "login" ? "Log in to Dubbed" : "Create your account"}</b>
      </div>

      {/* Email: signup only */}
      {mode === "register" && (
        <>
          <label className="fieldLbl">Email</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </>
      )}

      {mode !== "reset" && (
        <>
          {/* Username: both modes */}
          <label className="fieldLbl">
            Username {mode === "register" && <span className="lblHint">1–12 chars, symbols allowed</span>}
          </label>
          <input className="field" value={username} maxLength={mode === "register" ? 12 : 20} onChange={(e) => setUsername(e.target.value)} placeholder={mode === "login" ? "Your username" : "e.g. zK!"} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {mode === "register" && unameErr && <div className="fieldBad">{unameErr}</div>}

          <label className="fieldLbl">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "login" ? "Password" : "At least 8 characters"} onKeyDown={(e) => e.key === "Enter" && submit()} />

          {mode === "register" && (
            <>
              <label className="fieldLbl">Country</label>
              <select className="field" value={country} onChange={(e) => { setCountry(e.target.value); setStateCode(""); }}>
                <option value="">Select your country</option>
                {SIGNUP_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              {country === "US" && (
                <>
                  <label className="fieldLbl">State</label>
                  <select className="field" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </>
              )}
              {country === "CA" && (
                <>
                  <label className="fieldLbl">Province</label>
                  <select className="field" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                    <option value="">Select province</option>
                    {CA_PROVINCES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </>
              )}
            </>
          )}

          <div ref={turnstileRef} style={{ display: "flex", justifyContent: "center", margin: "12px 0 4px" }} />
          {turnstileError && <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Verification unavailable — you can still proceed.</div>}

          {err && <div className="errBanner">{err}</div>}
          {unverifiedEmail && mode === "login" && (
            <button className="linkSwap" onClick={async () => {
              setBusy(true);
              const res = await resendVerification(unverifiedEmail);
              setBusy(false);
              if (res.error) { setErr(res.error); return; }
              toast.success("Verification email sent! Check your inbox.");
              setUnverifiedEmail("");
              setErr("");
            }}>Resend verification email</button>
          )}

          <Button variant="primary" className="wide" loading={busy} onClick={submit}>
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
          <button className="linkSwap" onClick={() => { setMode(mode === "login" ? "register" : "login"); reset(); setUnverifiedEmail(""); }}>
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
          {mode === "login" && (
            <button className="linkSwap" onClick={() => { setMode("reset"); reset(); setUnverifiedEmail(""); }}>Forgot password?</button>
          )}
        </>
      )}
      {mode === "reset" && (
        <>
          <p className="modalNote">Enter your email and we'll send a password reset link.</p>
          <label className="fieldLbl">Email</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" onKeyDown={(e) => e.key === "Enter" && handleReset()} />
          {err && <div className="errBanner">{err}</div>}
          <Button variant="primary" className="wide" loading={busy} onClick={handleReset}>Send reset link</Button>
          <button className="linkSwap" onClick={() => { setMode("login"); reset(); }}>Back to login</button>
        </>
      )}
    </Modal>
  );
}
