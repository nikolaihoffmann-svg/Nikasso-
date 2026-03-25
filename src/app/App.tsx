// src/app/App.tsx
import React, { useMemo, useState } from "react";

import Oversikt from "../pages/Oversikt";
import Varer from "../pages/Varer";
import Innkjop from "../pages/Innkjop";
import Salg from "../pages/Salg";
import Kunder from "../pages/Kunder";
import Gjeld from "../pages/Gjeld";
import Backup from "../pages/Backup";

type Theme = "dark" | "light";
type TabKey = "oversikt" | "varer" | "innkjop" | "salg" | "kunder" | "gjeld" | "backup";

export function App() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [tab, setTab] = useState<TabKey>("oversikt");

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  const content = useMemo(() => {
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "innkjop") return <Innkjop />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    if (tab === "gjeld") return <Gjeld />;
    return <Backup />;
  }, [tab]);

  return (
    <div className={`container theme-${theme}`}>
      <header className="header">
        <div className="headerTop">
          <div>
            <div className="h1">NIKASSO</div>
          </div>

          <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setTab("backup")}>
              ⚙️ Data
            </button>

            <button className="themeBtn" type="button" onClick={toggleTheme} title="Bytt tema" aria-label="Bytt tema">
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>

        <nav className="tabs">
          <button className={`tab ${tab === "oversikt" ? "active" : ""}`} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={`tab ${tab === "varer" ? "active" : ""}`} onClick={() => setTab("varer")} type="button">
            Varer
          </button>
          <button className={`tab ${tab === "innkjop" ? "active" : ""}`} onClick={() => setTab("innkjop")} type="button">
            Innkjøp
          </button>
          <button className={`tab ${tab === "salg" ? "active" : ""}`} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={`tab ${tab === "kunder" ? "active" : ""}`} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
          <button className={`tab ${tab === "gjeld" ? "active" : ""}`} onClick={() => setTab("gjeld")} type="button">
            Gjeld
          </button>
        </nav>
      </header>

      {content}
    </div>
  );
}
