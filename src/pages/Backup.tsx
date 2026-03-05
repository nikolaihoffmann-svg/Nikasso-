// src/pages/Backup.tsx
import React, { useRef } from "react";
import { clearAllData, downloadExportAll, importAllFromFile } from "../app/storage";

export function Backup() {
  const importRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="card">
      <div className="cardTitle">Backup</div>
      <div className="cardSub">Eksporter/importer all data (varer, kunder, salg, gjeld).</div>

      <div className="btnRow">
        <button className="btn btnPrimary" type="button" onClick={() => downloadExportAll()}>
          Eksporter ALT
        </button>

        <button className="btn" type="button" onClick={() => importRef.current?.click()}>
          Importer ALT
        </button>

        <button
          className="btn btnDanger"
          type="button"
          onClick={() => {
            if (confirm("Slette ALL data i nettleseren? (Varer, kunder, salg, gjeld)")) clearAllData();
          }}
        >
          Nullstill
        </button>

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;

            try {
              await importAllFromFile(file, "replace");
              alert("Import OK ✅");
            } catch (err: any) {
              alert("Import feilet: " + String(err?.message ?? err));
            }
          }}
        />
      </div>
    </div>
  );
}
