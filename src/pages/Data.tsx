import { useMemo, useRef, useState } from "react";
import {
  clearAllData,
  downloadBackup,
  exportAllData,
  fmtKr,
  importBackupFile,
} from "../app/storage";

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");

  const backup = useMemo(() => exportAllData(), [message]);

  async function handleImport(file: File): Promise<void> {
    try {
      await importBackupFile(file);
      setMessage("Backup importert");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import feilet");
    }
  }

  return (
    <div>
      <h1 className="pageTitle">Data</h1>
      <p className="pageLead">Backup, import, status og nullstilling.</p>

      <div className="grid3">
        <div className="statCard">
          <div className="statLabel">Varer</div>
          <div className="statValue">{backup.items.length}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Kunder</div>
          <div className="statValue">{backup.customers.length}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Salg</div>
          <div className="statValue">{backup.sales.length}</div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Backup</h2>
          <div className="dataList">
            <button className="btn btnPrimary" type="button" onClick={downloadBackup}>
              Eksporter backup
            </button>

            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              Importer backup
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
              }}
            />
          </div>

          <div className="cardSub">
            Dette er grunnlaget for trygg lagring nå. Ekte sky-synk kan vi koble på senere.
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Status</h2>

          <div className="dataList">
            <div className="itemRow">
              <div>Saldo</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(backup.saldo)}</div>
            </div>

            <div className="itemRow">
              <div>Innkjøp</div>
              <div style={{ fontWeight: 700 }}>{backup.purchases.length}</div>
            </div>

            <div className="itemRow">
              <div>Eksportformat</div>
              <div className="badge badgeBlue">v{backup.version}</div>
            </div>
          </div>

          {message ? <div style={{ marginTop: 12, color: "#86efac" }}>{message}</div> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween">
          <h2 className="sectionTitle">Fareområde</h2>
          <button
            className="btn btnDanger"
            type="button"
            onClick={() => {
              if (confirm("Slette all lokal data?")) {
                clearAllData();
                window.location.reload();
              }
            }}
          >
            Nullstill alt
          </button>
        </div>

        <div className="cardSub">
          Bruk dette kun hvis du allerede har eksportert backup først.
        </div>
      </div>
    </div>
  );
}
