// src/pages/Backup.tsx
import React from "react";
import { downloadExportAll, pickImportAllFile, clearAllData, getStorageSummary, fmtKr, getSaldo } from "../app/storage";

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
  const s = getStorageSummary();
  const saldo = getSaldo();

  return (
    <div className="card">
      <div className="cardTitle">Data</div>
      <div className="cardSub">Eksporter/Importer ALT (varer, kunder, salg, gjeld, saldo).</div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Status</p>
          <div className="itemMeta">
            Varer: <b>{s.items}</b> • Kunder: <b>{s.customers}</b> • Salg: <b>{s.sales}</b> • Gjeld: <b>{s.receivables}</b>
            <br />
            Saldo: <b>{fmtKr(saldo)}</b>
            <br />
            Ca lagringsstørrelse: <b>{fmtBytes(s.approxBytes)}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Backup</p>
          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={downloadExportAll}>
              Eksporter ALT
            </button>
            <button className="btn" type="button" onClick={pickImportAllFile("replace")}>
              Importer (erstatt)
            </button>
            <button className="btn" type="button" onClick={pickImportAllFile("merge")}>
              Importer (slå sammen)
            </button>
          </div>
          <div className="itemMeta" style={{ marginTop: 10 }}>
            • <b>Erstatt</b> = bytter ut alt lokalt med filen.
            <br />• <b>Slå sammen</b> = prøver å merge på id (greit hvis du har data begge steder).
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Nullstill</p>
          <div className="btnRow">
            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) clearAllData();
              }}
            >
              Nullstill alt
            </button>
          </div>
          <div className="itemMeta" style={{ marginTop: 10 }}>
            Tips: Ta en backup før du nullstiller.
          </div>
        </div>
      </div>
    </div>
  );
}
