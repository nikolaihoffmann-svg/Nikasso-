import { useMemo, useRef, useState } from "react";
import {
  adjustSaldo,
  clearAllData,
  downloadBackup,
  exportAllData,
  fmtKr,
  importBackupFile,
  projectedTotalValue,
  totalDebtOutstanding,
  totalReceivables,
  totalSalesOutstanding,
} from "../app/storage";

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [saldoAdjust, setSaldoAdjust] = useState("");

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

  function handleSaldoAdjust(): void {
    const amount = Number(saldoAdjust || 0);
    if (!amount) return;
    adjustSaldo(amount);
    setSaldoAdjust("");
    setMessage("Saldo oppdatert");
  }

  const salesOpen = totalSalesOutstanding();
  const debtsOpen = totalDebtOutstanding();
  const receivables = totalReceivables();
  const potentialTotal = projectedTotalValue();

  return (
    <div>
      <h1 className="pageTitle">Data</h1>
      <p className="pageLead">Backup, import, status, saldo og nullstilling.</p>

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

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Saldo og totaler</h2>

          <div className="featureList">
            <div className="itemRow">
              <div>Saldo nå</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(backup.saldo)}</div>
            </div>

            <div className="itemRow">
              <div>Utestående salg</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(salesOpen)}</div>
            </div>

            <div className="itemRow">
              <div>Gjeld / lån til gode</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(debtsOpen)}</div>
            </div>

            <div className="itemRow">
              <div>Totalt til gode</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(receivables)}</div>
            </div>

            <div className="itemRow">
              <div>Potensiell totalverdi</div>
              <div style={{ fontWeight: 700 }}>{fmtKr(potentialTotal)}</div>
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 14 }}>
            <label className="label">
              <span>Juster saldo (+ / -)</span>
              <input
                type="number"
                value={saldoAdjust}
                onChange={(e) => setSaldoAdjust(e.target.value)}
                placeholder="f.eks. 500 eller -250"
              />
            </label>

            <div className="cardActions" style={{ marginTop: 0 }}>
              <button className="btn btnPrimary" type="button" onClick={handleSaldoAdjust}>
                Oppdater saldo
              </button>
            </div>
          </div>
        </div>

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
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="sectionTitle">Status</h2>

        <div className="dataList">
          <div className="itemRow">
            <div>Innkjøp</div>
            <div style={{ fontWeight: 700 }}>{backup.purchases.length}</div>
          </div>

          <div className="itemRow">
            <div>Gjeldsposter</div>
            <div style={{ fontWeight: 700 }}>{backup.debts.length}</div>
          </div>

          <div className="itemRow">
            <div>Eksportformat</div>
            <div className="badge badgeBlue">v{backup.version}</div>
          </div>
        </div>

        {message ? <div style={{ marginTop: 12, color: "#86efac" }}>{message}</div> : null}
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
