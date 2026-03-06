// src/pages/Backup.tsx
import React, { useRef, useState } from "react";
import { clearAllData, downloadExportAll, importAllFromFile } from "../app/storage";

export function Backup() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  return (
    <div className="card">
      <div className="cardTitle">Backup</div>
      <div className="cardSub">Eksporter / importer alt (varer, kunder, salg, gjeld). Import kan enten erstatte alt eller merge.</div>

      <div className="fieldGrid">
        <div>
          <label className="label">Import-modus</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="replace">Erstatt ALT</option>
            <option value="merge">Merge (legg til / oppdater på id)</option>
          </select>
        </div>

        <div className="btnRow">
          <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
            Eksporter ALT (JSON)
          </button>

          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Importer fra fil…
          </button>

          <button
            className="btn btnDanger"
            type="button"
            onClick={() => {
              if (confirm("Slette ALL data i nettleseren?")) clearAllData();
            }}
          >
            Nullstill ALT
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!f) return;
            try {
              await importAllFromFile(f, mode);
              alert("Import ferdig ✅");
            } catch (err: any) {
              alert("Import feilet: " + (err?.message || String(err)));
            }
          }}
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="cardTitle">Tips</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          “Erstatt ALT” er tryggest hvis du vil restore en backup. “Merge” er nyttig hvis du vil samle data fra flere enheter.
        </div>
      </div>
    </div>
  );
}
