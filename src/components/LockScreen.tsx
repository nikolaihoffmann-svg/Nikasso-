import { useMemo, useState } from "react";

type Props = {
  onUnlock: (pin: string) => boolean;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export default function LockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const dots = useMemo(() => {
    return [0, 1, 2, 3].map((i) => i < pin.length);
  }, [pin]);

  function handleSubmit(): void {
    if (pin.length !== 4) {
      setError("Skriv inn 4 sifre");
      return;
    }

    const ok = onUnlock(pin);
    if (!ok) {
      setError("Feil PIN");
      setPin("");
      return;
    }

    setError("");
  }

  return (
    <div className="lockScreen">
      <div className="lockCard">
        <div className="lockLogoWrap">
          <div className="lockLogoBadge">N+</div>
        </div>

        <h1 className="lockTitle">Nikasso+</h1>
        <p className="lockLead">Lås opp med PIN for å åpne appen.</p>

        <div className="pinDots" aria-hidden="true">
          {dots.map((filled, index) => (
            <div
              key={index}
              className={filled ? "pinDot pinDotFilled" : "pinDot"}
            />
          ))}
        </div>

        <label className="label" style={{ marginTop: 18 }}>
          <span>4-sifret PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => {
              setPin(onlyDigits(e.target.value));
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="••••"
            maxLength={4}
            className="lockInput"
          />
        </label>

        {error ? <div className="lockError">{error}</div> : null}

        <button className="btn btnPrimary lockBtn" type="button" onClick={handleSubmit}>
          Lås opp
        </button>
      </div>
    </div>
  );
}
