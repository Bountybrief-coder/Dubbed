import React, { useState } from "react";
import { Gamepad2, Monitor, Check, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { updateProfile } from "../services/profileService";
import { Button } from "./Button";

const PLATFORMS = ["PC", "Console"];

export function OnboardingModal({ onComplete }) {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [activisionId, setActivisionId] = useState(profile?.activision_id || "");
  const [platform, setPlatform] = useState(profile?.platform || "");
  const [saving, setSaving] = useState(false);

  async function handleSaveGamertag() {
    const tag = activisionId.trim();
    if (!tag) return toast.error("Enter your Activision ID / gamertag");
    if (tag.length < 3) return toast.error("Gamertag too short");
    setSaving(true);
    const res = await updateProfile(user.id, { activision_id: tag });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    setStep(2);
  }

  async function handleSavePrefs() {
    if (!platform) return toast.error("Select your platform");
    setSaving(true);
    const res = await updateProfile(user.id, { platform });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    await refreshProfile();
    setStep(3);
  }

  function handleFinish() {
    onComplete?.();
  }

  return (
    <div className="modalBackdrop">
      <section className="modalCard modal-md obModal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="obProgress">
          {[1, 2, 3].map(s => (
            <div key={s} className={`obDot ${step >= s ? "active" : ""} ${step > s ? "done" : ""}`}>
              {step > s ? <Check size={12} /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="obStep">
            <div className="obIcon"><Gamepad2 size={32} /></div>
            <h2>What's your gamertag?</h2>
            <p className="sub">Enter your Activision ID so opponents and teammates can find you.</p>
            <input
              className="obInput"
              type="text"
              placeholder="YourName#1234567"
              value={activisionId}
              onChange={e => setActivisionId(e.target.value)}
              maxLength={50}
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleSaveGamertag()}
            />
            <Button onClick={handleSaveGamertag} loading={saving} style={{ width: "100%" }}>
              Continue <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="obStep">
            <div className="obIcon"><Monitor size={32} /></div>
            <h2>What do you play on?</h2>
            <p className="sub">Select your platform for better matchmaking.</p>
            <div className="obOptionGroup">
              <span className="obLabel">Platform</span>
              <div className="obOptions">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`obOption ${platform === p ? "selected" : ""}`}
                    onClick={() => setPlatform(p)}
                  >
                    <Monitor size={14} /> {p}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSavePrefs} loading={saving} style={{ width: "100%" }}>
              Continue <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="obStep obDone">
            <div className="obDoneIcon"><Check size={36} /></div>
            <h2>You're all set!</h2>
            <p className="sub">Jump into matches, find teammates, or join a tournament.</p>
            <Button onClick={handleFinish} style={{ width: "100%" }}>
              Let's Go
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
