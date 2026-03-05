// src/app/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyThemeToDom,
  getTheme,
  setTheme,
  Theme,
  downloadExportAll,
  importAllFromFile,
  clearAllData,
} from "./storage";

import { Oversikt } from "../pages/Oversikt";
import { Varer } from "../pages/Varer";
import { Salg } from "../pages/Salg";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type TabKey = "oversikt" | "varer" | "salg" | "kunder" | "gjeld";

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [tab, setTab] = useState<TabKey>("oversikt");

  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  const content = useMemo(() => {
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    return <Gjeld />;
  }, [tab]);

  const title = useMemo(() => {
    if (tab === "oversikt") return "Oversikt";
    if (tab === "varer") return "Varer";
    if (tab === "salg") return "Salg";
    if (tab === "kunder") return "Kunder";
    return "Gjeld";
  }, [tab]);

  return (
    <div className="container">
      <header className="header">
        <div className="headerTop">
          <div>
            <div className="h1">{title}</div>
            <div className="subRow">
              <div className="sub">Privat • Lokal lagring i nettleseren</div>
            </div>
          </div>

          <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            {/* ✅ 1) Eksport = wrap i arrow */}
            <button className="btn" type="button" onClick={() => downloadExportAll()}>
              Eksporter ALT
            </button>

            {/* ✅ 2) Import = åpne filvelger */}
            <button className="btn" type="button" onClick={() => importRef.current?.click()}>
              Importer ALT
            </button>

            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) clearAllData();
              }}
            >
              Nullstill
            </button>

            <button className="themeBtn" type="button" onClick={toggleTheme} title="Bytt tema">
              {theme === "dark" ? "🌙 Mørk" : "☀️ Lys"}
            </button>

            {/* Hidden file input for import */}
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;

                try {
                  await importAllFromFile(file, "replace");
                  alert("Import OK ✅");
                } catch (err: any) {
                  alert("Import feilet: " + String(err?.message ?? err));
                }
              }}
            />
          </div>
        </div>

        <nav className="tabs">
          <button className={`tab ${tab === "oversikt" ? "active" : ""}`} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={`tab ${tab === "varer" ? "active" : ""}`} onClick={() => setTab("varer")} type="button">
            Varer
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
