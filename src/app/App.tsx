// src/app/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { applyThemeToDom, getTheme, setTheme, Theme } from "./storage";

import { Varer } from "../pages/Varer";
import { Salg } from "../pages/Salg";
import { Kunder } from "../pages/Kunder";

type TabKey = "oversikt" | "varer" | "salg" | "kunder";

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [tab, setTab] = useState<TabKey>("oversikt");

  useEffect(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? "Mørk" : "Lys";
  const themeIcon = theme === "dark" ? "🌙" : "☀️";

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  const content = useMemo(() => {
    if (tab === "oversikt") {
      return (
        <div className="card">
          <div className="cardTitle">Oversikt</div>
          <div className="cardSub">Velg en fane under for å jobbe med varer, salg og kunder.</div>
        </div>
      );
    }
    if (tab === "varer") return <Varer />;
    if (tab === "salg") return <Salg />;
    return <Kunder />;
  }, [tab]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Oversikt</h1>

        <div className="topbar">
          <div className="subtitle">Privat • Lokal lagring i nettleseren</div>

          <button
            type="button"
            className="themeBtn"
            onClick={toggleTheme}
            aria-label={`Bytt tema (nå: ${themeLabel})`}
            title="Bytt tema"
          >
            <span className="themeIcon">{themeIcon}</span>
            <span className="themeText">{themeLabel}</span>
          </button>
        </div>

        <nav className="tabs">
          <button className={`tabBtn ${tab === "oversikt" ? "active" : ""}`} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={`tabBtn ${tab === "varer" ? "active" : ""}`} onClick={() => setTab("varer")} type="button">
            Varer
          </button>
          <button className={`tabBtn ${tab === "salg" ? "active" : ""}`} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={`tabBtn ${tab === "kunder" ? "active" : ""}`} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
        </nav>
      </header>

      <main className="main">{content}</main>
    </div>
  );
}
