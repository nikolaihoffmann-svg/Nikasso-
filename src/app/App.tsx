// src/app/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  applyThemeToDom,
  clearAllData,
  downloadExportAll,
  getTheme,
  pickImportAllFile,
  setTheme,
  Theme,
} from "./storage";

import { Oversikt } from "../pages/Oversikt";
import { Varer } from "../pages/Varer";
import { Salg } from "../pages/Salg";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type TabKey = "oversikt" | "varer" | "salg" | "kunder" | "gjeld";

function Modal(props: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
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
  const [dataOpen, setDataOpen] = useState(false);

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

  return (
    <div className="container">
      <header className="header">
        <div className="headerTop">
          <div>
            <div className="h1">NIKASSO</div>
          </div>

          <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setDataOpen(true)} title="Backup / Import / Nullstill">
              ⚙️ Data
            </button>

            <button
              className="themeBtn"
              type="button"
              onClick={toggleTheme}
              title="Bytt tema"
              aria-label="Bytt tema"
            >
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

      <Modal open={dataOpen} title="Data (backup / import)" onClose={() => setDataOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div className="itemMeta" style={{ marginTop: 0 }}>
            Her kan du eksportere alt, importere en backup eller nullstille data.
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
              Eksporter ALT
            </button>

            <button className="btn" type="button" onClick={() => pickImportAllFile("replace")}>
              Importer ALT
            </button>

            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette ALL data? (Varer, kunder, salg, gjeld, saldo)")) {
                  clearAllData();
                  setDataOpen(false);
                }
              }}
            >
              Nullstill
            </button>
          </div>

          <div className="itemMeta" style={{ marginTop: 10 }}>
            Tips: Import “replace” overskriver. Hvis du senere vil ha “merge”, sier du ifra så legger jeg det inn som en ekstra knapp.
          </div>
        </div>
      </Modal>
    </div>
  );
}
