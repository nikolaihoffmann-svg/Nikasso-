// src/pages/Backup.tsx
import React, { useRef, useState } from "react";
import { clearAllData, downloadExportAll, importAllFromFile } from "../app/storage";

export function Backup() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAllFromFile(file, mode);
    e.target.value = "";
    alert("Import ferdig ✅");
  }

  return (
    <div className="card">
      <div className="cardTitle">Backup</div>
      <div className="cardSub">Eksport/import av absolutt all data (varer, kunder, salg, gjeld, saldo).</div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Eksport</p>
          <div className="itemMeta">Laster ned en .json-fil du kan lagre i iCloud/Files.</div>
          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
              Eksporter ALT
            </button>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Import</p>
          <div className="itemMeta">Velg hvordan import skal oppføre seg:</div>

          <div className="row3" style={{ marginTop: 10 }}>
            <div>
              <label className="label">Modus</label>
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="replace">Erstatt alt</option>
                <option value="merge">Slå sammen (merge)</option>
              </select>
            </div>
            <div />
            <div />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={() => fileRef.current?.click()}>
              Importer ALT
            </button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onPickFile} />
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Nullstill</p>
          <div className="itemMeta">Sletter all lagret data i nettleseren (inkludert saldo).</div>
          <div className="btnRow">
            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette ALL data? (Varer, kunder, salg, gjeld, saldo)")) {
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
    </div>
  );
}
