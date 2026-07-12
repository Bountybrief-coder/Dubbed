import React, { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { validateUsername, validateEmail, validatePassword } from "../utils/validation";
import { isUsernameTaken } from "../services/profileService";
import { requestPasswordReset, resendVerification } from "../services/authService";
import logoMark from "../assets/dubbed-mark-tight.png";

export function AuthModal({ open, onClose }) {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

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
      setBusy(true);
      if (await isUsernameTaken(username)) {
        setBusy(false);
        return setErr("That username is already taken.");
      }
      const res = await signUp({ email, username, password });
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
      // Login: username + password only.
      setBusy(true);
      const res = await signIn({ username, password });
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
    setEmail(""); setUsername(""); setPassword(""); setErr(""); setBusy(false); setMode("login"); setUnverifiedEmail("");
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
            Username {mode === "register" && <span className="lblHint">1–8 chars, symbols allowed</span>}
          </label>
          <input className="field" value={username} maxLength={mode === "register" ? 8 : 20} onChange={(e) => setUsername(e.target.value)} placeholder={mode === "login" ? "Your username" : "e.g. zK!"} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {mode === "register" && unameErr && <div className="fieldBad">{unameErr}</div>}

          <label className="fieldLbl">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "login" ? "Password" : "At least 6 characters"} onKeyDown={(e) => e.key === "Enter" && submit()} />

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
