// src/pages/Backup.tsx
import React, { useMemo } from "react";
import { downloadExportAll, getStorageSummary, pickImportAllFile, clearAllData, fmtKr } from "../app/storage";

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function Backup() {
  const summary = useMemo(() => getStorageSummary(), []);

  return (
    <div className="card">
      <div className="cardTitle">Data</div>
      <div className="cardSub">Eksporter/Importer alt. Dette ligger kun lokalt i nettleseren.</div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Status</p>
          <div className="itemMeta">
            Varer: <b>{summary.itemsCount}</b> • Kunder: <b>{summary.customersCount}</b> • Salg: <b>{summary.salesCount}</b> • Gjeld:{" "}
            <b>{summary.receivablesCount}</b>
            <br />
            Utestående salg: <b>{fmtKr(summary.unpaidSales)}</b>
            <br />
            Gjeld til deg: <b>{fmtKr(summary.unpaidReceivables)}</b>
            <br />
            Saldo: <b>{fmtKr(summary.saldo)}</b>
            <br />
            Ca lagringsstørrelse: <b>{fmtBytes(summary.approxBytes)}</b>
          </div>
        </div>
      </div>

      <div className="btnRow">
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

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Tips</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Eksportfilen kan du lagre i iCloud/Drive. Import “slå sammen” er fin hvis du har data på flere enheter.
        </div>
      </div>
    </div>
  );
}
