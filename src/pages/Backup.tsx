// src/pages/Backup.tsx
import React from "react";
import { clearAllData, importAllFromFile, downloadExportAll } from "../app/storage";

export function Backup() {
  return (
    <div className="card">
      <div className="cardTitle">Backup / Restore</div>
      <div className="cardSub">
        Eksporter eller importer <b>alt</b> (varer, kunder, salg, gjeld, tema).
      </div>

      <div className="btnRow">
        <button className="btn btnPrimary" type="button" onClick={downloadExportAll}>
          Eksporter ALT (JSON)
        </button>

        <button className="btn" type="button" onClick={importAllFromFile}>
          Importer ALT (JSON)
        </button>

        <button
          className="btn btnDanger"
          type="button"
          onClick={() => {
            if (confirm("Slette ALL data i appen? Dette kan ikke angres.")) {
              clearAllData();
              alert("All data slettet.");
            }
          }}
        >
          Slett all data
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Tips</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Ta en export før du gjør store endringer. Filen kan lagres i iCloud/Google Drive og importeres igjen senere.
        </div>
      </div>
    </div>
  );
}
