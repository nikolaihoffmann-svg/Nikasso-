// src/pages/Backup.tsx
import React from "react";
import { clearAllData, downloadExportAll, importAllFromFile, getStorageSummary, fmtKr } from "../app/storage";

export function Backup() {
  const s = getStorageSummary();

  return (
    <div className="card">
      <div className="cardTitle">Data</div>
      <div className="cardSub">Backup / import / nullstill (lokalt i nettleseren).</div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Status</p>
          <div className="itemMeta">
            Varer: <b>{s.items}</b> • Kunder: <b>{s.customers}</b> • Salg: <b>{s.sales}</b> • Gjeld: <b>{s.receivables}</b>
            <br />
            Saldo: <b>{fmtKr(s.saldo)}</b>
          </div>
        </div>
      </div>

      <div className="btnRow" style={{ marginTop: 12 }}>
        <button className="btn btnPrimary" type="button" onClick={downloadExportAll}>
          Eksporter ALT
        </button>
        <button className="btn" type="button" onClick={importAllFromFile}>
          Importer ALT
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

      <div className="itemMeta" style={{ marginTop: 10 }}>
        Tips: Ta alltid “Eksporter ALT” før du gjør store endringer i koden.
      </div>
    </div>
  );
}
