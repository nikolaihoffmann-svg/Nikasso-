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
import { Backup } from "../pages/Backup";

type TabKey = "oversikt" | "varer" | "salg" | "kunder" | "gjeld" | "backup";

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [tab, setTab] = useState<TabKey>("oversikt");

  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  async function handleImportReplace(file: File) {
    await importAllFromFile(file, "replace");
    alert("Import OK ✅");
  }

  const content = useMemo(() => {
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    if (tab === "gjeld") return <Gjeld />;
    return <Backup />;
  }, [tab]);

  return (
    <div className="container">
      <header className="header">
        <div className="headerTop">
          <div>
            <div className="h1">Oversikt</div>
            <div className="subRow">
              <div className="sub">Privat • Lokal lagring i nettleseren</div>
            </div>
          </div>

          <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            {/* Eksport */}
            <button className="btn" type="button" onClick={() => downloadExportAll()}>
              Eksporter ALT
            </button>

            {/* Import (via hidden file input) */}
            <button
              className="btn"
              type="button"
              onClick={() => {
                importInputRef.current?.click();
              }}
            >
              Importer ALT
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                try {
                  await handleImportReplace(file);
                } catch (err: any) {
                  alert(`Import feilet: ${String(err?.message ?? err)}`);
                }
              }}
            />

            {/* Nullstill */}
            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) clearAllData();
              }}
            >
              Nullstill
            </button>

            {/* Tema */}
            <button className="themeBtn" type="button" onClick={toggleTheme} title="Bytt tema">
              {theme === "dark" ? "🌙 Mørk" : "☀️ Lys"}
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
          <button className={`tab ${tab === "salg" ? "active" : ""}`} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={`tab ${tab === "kunder" ? "active" : ""}`} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
          <button className={`tab ${tab === "gjeld" ? "active" : ""}`} onClick={() => setTab("gjeld")} type="button">
            Gjeld
          </button>
          <button className={`tab ${tab === "backup" ? "active" : ""}`} onClick={() => setTab("backup")} type="button">
            Backup
          </button>
        </nav>
      </header>

      {content}
    </div>
  );
}
