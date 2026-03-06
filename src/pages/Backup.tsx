// src/pages/Backup.tsx
import React from "react";
import { clearAllData, downloadExportAll, pickImportAllFile } from "../app/storage";

export function Backup() {
  return (
    <div className="card">
      <div className="cardTitle">Backup</div>
      <div className="cardSub">Eksporter/importer all data (varer, kunder, salg, gjeld, saldo).</div>

      <div className="btnRow" style={{ marginTop: 12 }}>
        <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
          Eksporter ALT
        </button>

        <button className="btn" type="button" onClick={() => pickImportAllFile("replace")}>
          Importer (erstatt)
        </button>

        <button className="btn" type="button" onClick={() => pickImportAllFile("merge")}>
          Importer (slå sammen)
        </button>

        <button
          className="btn btnDanger"
          type="button"
          onClick={() => {
            if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld, saldo)")) clearAllData();
          }}
        >
          Nullstill
        </button>
      </div>
    </div>
  );
}
