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

function Modal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <p className="modalTitle">{props.title}</p>
          <button className="iconBtn" type="button" onClick={props.onClose} aria-label="Lukk">
            ✕
          </button>
        </div>
        <div className="modalBody">{props.children}</div>
      </div>
    </div>
  );
}

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [tab, setTab] = useState<TabKey>("oversikt");

  const [menuOpen, setMenuOpen] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);

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
    if (tab === "gjeld") return <Gjeld />;
    return <Backup />;
  }, [tab]);

  return (
    <div className="container">
      <header className="header">
        <div className="headerTop">
          <div>
            <div className="h1">NIKASSO</div>
          </div>

          <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            {/* Meny-knapp */}
            <button className="btn" type="button" onClick={() => setMenuOpen(true)} title="Meny">
              ☰
            </button>

            {/* Tema som ikon */}
            <button className="themeBtn" type="button" onClick={toggleTheme} title="Bytt tema">
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

      {/* Skjult fil-input for Import */}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await importAllFromFile(f, "replace");
          e.target.value = "";
          setMenuOpen(false);
        }}
      />

      {/* Meny-modal */}
      <Modal open={menuOpen} title="Meny" onClose={() => setMenuOpen(false)}>
        <div className="btnRow" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button
            className="btn btnPrimary"
            type="button"
            onClick={() => {
              downloadExportAll();
              setMenuOpen(false);
            }}
          >
            Eksporter ALT
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => {
              importInputRef.current?.click();
            }}
          >
            Importer ALT
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => {
              setTab("backup");
              setMenuOpen(false);
            }}
          >
            Backup
          </button>

          <button
            className="btn btnDanger"
            type="button"
            onClick={() => {
              if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) {
                clearAllData();
                setMenuOpen(false);
              }
            }}
          >
            Nullstill
          </button>
        </div>
      </Modal>
    </div>
  );
}
