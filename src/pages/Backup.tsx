// src/pages/Backup.tsx
import React, { useRef, useState } from "react";
import { clearAllData, downloadExportAll, importAllFromFile } from "../app/storage";

export function Backup() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  async function onPickFile(file: File) {
    await importAllFromFile(file, mode);
    alert(`Import OK ✅ (${mode === "replace" ? "erstattet" : "merget"})`);
  }

  return (
    <div className="card">
      <div className="cardTitle">Backup</div>
      <div className="cardSub">Eksporter / importer absolutt all data (varer, kunder, salg, gjeld).</div>

      <div className="item">
        <div className="itemTitle" style={{ marginBottom: 10 }}>Eksport</div>
        <div className="itemMeta">Laster ned én JSON-fil med alt.</div>
        <div className="btnRow">
          <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
            Eksporter ALT (JSON)
          </button>
        </div>
      </div>

      <div className="item">
        <div className="itemTitle" style={{ marginBottom: 10 }}>Import</div>
        <div className="itemMeta" style={{ marginBottom: 10 }}>
          <b>Replace</b> = erstatter alt. <b>Merge</b> = slår sammen på id.
        </div>

        <div className="btnRow" style={{ marginTop: 0 }}>
          <button className={`btn ${mode === "replace" ? "btnPrimary" : ""}`} type="button" onClick={() => setMode("replace")}>
            Replace
          </button>
          <button className={`btn ${mode === "merge" ? "btnPrimary" : ""}`} type="button" onClick={() => setMode("merge")}>
            Merge
          </button>

          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Velg JSON og importer
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              try {
                await onPickFile(file);
              } catch (err: any) {
                alert(`Import feilet: ${String(err?.message ?? err)}`);
              }
            }}
          />
        </div>
      </div>

      <div className="item low">
        <div className="itemTitle" style={{ marginBottom: 10 }}>Nullstill</div>
        <div className="itemMeta">Sletter alt lokalt (varer, kunder, salg, gjeld). Tema beholdes.</div>
        <div className="btnRow">
          <button
            className="btn btnDanger"
            type="button"
            onClick={() => {
              if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) {
                clearAllData();
                alert("Nullstilt ✅");
              }
            }}
          >
            Nullstill ALT
          </button>
        </div>
      </div>
    </div>
  );
}
