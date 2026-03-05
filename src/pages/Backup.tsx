// src/pages/Backup.tsx
import React, { useRef, useState } from "react";

type Props = {
  onExportAll: () => void;
  onImportReplace: (file: File) => void | Promise<void>;
  onImportMerge: (file: File) => void | Promise<void>;
  onClearAll: () => void;
};

export function Backup(props: Props) {
  const fileRefReplace = useRef<HTMLInputElement | null>(null);
  const fileRefMerge = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);

  async function handleImport(file: File | undefined, mode: "replace" | "merge") {
    if (!file) return;
    try {
      setBusy(true);
      if (mode === "replace") await props.onImportReplace(file);
      else await props.onImportMerge(file);
      alert("Import ferdig ✅");
    } catch (e: any) {
      alert(`Import feilet: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
      // reset input så du kan velge samme fil igjen
      if (mode === "replace" && fileRefReplace.current) fileRefReplace.current.value = "";
      if (mode === "merge" && fileRefMerge.current) fileRefMerge.current.value = "";
    }
  }

  function confirmClear() {
    if (!confirm("Slette ALL data (varer, kunder, salg, gjeld)? Dette kan ikke angres.")) return;
    props.onClearAll();
    alert("Alt slettet.");
  }

  return (
    <div className="card">
      <div className="cardTitle">Backup / Export</div>
      <div className="cardSub">
        Eksporter eller importer <b>absolutt all data</b> (varer, kunder, salg, gjeld).
      </div>

      <div className="btnRow">
        {/* ✅ viktig: wrapper, ellers TS2322 (MouseEvent blir filename) */}
        <button className="btn btnPrimary" type="button" onClick={() => props.onExportAll()} disabled={busy}>
          Export all (JSON)
        </button>

        <button
          className="btn"
          type="button"
          onClick={() => fileRefReplace.current?.click()}
          disabled={busy}
          title="Import: erstatt alt med filens innhold"
        >
          Import (replace)
        </button>

        <button
          className="btn"
          type="button"
          onClick={() => fileRefMerge.current?.click()}
          disabled={busy}
          title="Import: slå sammen med eksisterende data"
        >
          Import (merge)
        </button>

        <button className="btn btnDanger" type="button" onClick={confirmClear} disabled={busy}>
          Slett alt
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileRefReplace}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          // ✅ wrapper (ikke send event videre)
          handleImport(f, "replace");
        }}
      />

      <input
        ref={fileRefMerge}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleImport(f, "merge");
        }}
      />

      <div className="card" style={{ marginTop: 18 }}>
        <div className="cardTitle">Tips</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          1) Ta export før større endringer. <br />
          2) “Replace” brukes når du vil gjenopprette helt fra backup. <br />
          3) “Merge” er nyttig hvis du vil legge inn data fra en annen enhet uten å miste det du har.
        </div>
      </div>
    </div>
  );
}
