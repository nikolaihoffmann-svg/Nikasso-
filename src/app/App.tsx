// src/app/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { applyThemeToDom, getTheme, setTheme, Theme } from "./storage";

import { Oversikt } from "../pages/Oversikt";
import { Salg } from "../pages/Salg";
import { Varer } from "../pages/Varer";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type Tab = "oversikt" | "salg" | "varer" | "kunder" | "gjeld";

export function App() {
  const [tab, setTab] = useState<Tab>("oversikt");
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  // Apply theme on mount + whenever it changes
  useEffect(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  }, [theme]);

  const themeLabel = useMemo(() => (theme === "dark" ? "☀️ Lys" : "🌙 Mørk"), [theme]);

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="headerTop">
          <div>
            <h1 className="appTitle">{tabTitle(tab)}</h1>
            <div className="appSub">Privat • Lokal lagring i nettleseren</div>
          </div>

          <button
            type="button"
            className="btn themeBtn"
            onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Bytt tema"
            title="Bytt tema"
          >
            {themeLabel}
          </button>
        </div>

        <nav className="tabs">
          <button className={tab === "oversikt" ? "tab active" : "tab"} onClick={() => setTab("oversikt")}>
            Oversikt
          </button>
          <button className={tab === "salg" ? "tab active" : "tab"} onClick={() => setTab("salg")}>
            Salg
          </button>
          <button className={tab === "varer" ? "tab active" : "tab"} onClick={() => setTab("varer")}>
            Varer
          </button>
          <button className={tab === "kunder" ? "tab active" : "tab"} onClick={() => setTab("kunder")}>
            Kunder
          </button>
          <button className={tab === "gjeld" ? "tab active" : "tab"} onClick={() => setTab("gjeld")}>
            Gjeld
          </button>
        </nav>
      </header>

      <main className="appMain">
        {tab === "oversikt" ? <Oversikt /> : null}
        {tab === "salg" ? <Salg /> : null}
        {tab === "varer" ? <Varer /> : null}
        {tab === "kunder" ? <Kunder /> : null}
        {tab === "gjeld" ? <Gjeld /> : null}
      </main>
    </div>
  );
}

function tabTitle(t: Tab) {
  if (t === "oversikt") return "Oversikt";
  if (t === "salg") return "Salg";
  if (t === "varer") return "Varer";
  if (t === "kunder") return "Kunder";
  return "Gjeld";
}
