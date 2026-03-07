// src/pages/Backup.tsx
import React, { useMemo } from "react";
import { clearAllData, downloadExportAll, fmtKr, getStorageSummary, pickImportAllFile } from "../app/storage";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round((n / 1024) * 10) / 10} KB`;
  return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;
}

export function Backup() {
  const summary = useMemo(() => getStorageSummary(), []);

  return (
    <div className="card">
      <div className="cardTitle">Data</div>
      <div className="cardSub">Eksport / import av ALT (varer, kunder, salg, gjeld, saldo, tema).</div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Status</p>
          <div className="itemMeta">
            Varer: <b>{summary.itemsCount}</b> • Kunder: <b>{summary.customersCount}</b> • Salg: <b>{summary.salesCount}</b> • Gjeld:
            <b> {summary.receivablesCount}</b>
            <br />
            Saldo: <b>{fmtKr(summary.saldo)}</b>
            <br />
            Utestående salg: <b>{fmtKr(summary.unpaidSales)}</b>
            <br />
            Utestående gjeld til deg: <b>{fmtKr(summary.unpaidReceivables)}</b>
            <br />
            Ca lagring: <b>{fmtBytes(summary.approxBytes)}</b>
          </div>
        </div>
      </div>

      <div className="btnRow" style={{ marginTop: 14 }}>
        <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
          Eksporter ALT
        </button>

        <button className="btn" type="button" onClick={() => pickImportAllFile("replace")}>
          Importer (erstatt)
        </button>

        <button className="btn" type="button" onClick={() => pickImportAllFile("merge")}>
          Importer (merge)
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

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Tips</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Eksporter før du gjør store endringer. Import “merge” er nyttig hvis du vil slå sammen data fra flere enheter.
        </div>
      </div>
    </div>
  );
}
