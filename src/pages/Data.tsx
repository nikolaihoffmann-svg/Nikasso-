import { useMemo, useRef, useState } from "react";
import {
  adjustSaldo,
  clearAllData,
  downloadBackup,
  exportAllData,
  fmtKr,
  importBackupFile,
  inventoryValue,
  totalDebtOutstanding,
  totalReceivables,
  totalSalesOutstanding,
} from "../app/storage";

function parseNoNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [saldoAdjust, setSaldoAdjust] = useState("");

  const backup = useMemo(() => exportAllData(), [message]);
  const debts = backup.debts ?? [];

  async function handleImport(file: File): Promise<void> {
    try {
      await importBackupFile(file);
      setMessage("Backup importert");
      if (fileRef.current) fileRef.current.value = "";
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import feilet");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSaldoAdjust(): void {
    const amount = parseNoNumber(saldoAdjust);
    if (!Number.isFinite(amount) || amount === 0) return;

    adjustSaldo(amount);
    setSaldoAdjust("");
    setMessage(`Saldo oppdatert med ${amount > 0 ? "+" : ""}${fmtKr(amount)}`);
  }

  const salesOpen = totalSalesOutstanding();
  const debtsOpen = totalDebtOutstanding();
  const receivables = totalReceivables();
  const stockValue = inventoryValue(backup.items ?? []);
  const potentialTotal = (backup.saldo ?? 0) + receivables + stockValue;

  return (
    <div>
      <h1 className="pageTitle">Data</h1>
      <p className="pageLead">Backup, status, saldo og samlet verdi på ett sted.</p>

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

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="statCard">
          <div className="statLabel">Saldo nå</div>
          <div className="statValue">{fmtKr(backup.saldo)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Utestående salg</div>
          <div className="statValue debtText">{fmtKr(salesOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Gjeld / lån til gode</div>
          <div className="statValue debtText">{fmtKr(debtsOpen)}</div>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="statCard">
          <div className="statLabel">Samlet til gode</div>
          <div className="statValue">{fmtKr(receivables)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Lagerverdi</div>
          <div className="statValue">{fmtKr(stockValue)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Potensiell totalverdi</div>
          <div className="statValue">{fmtKr(potentialTotal)}</div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Juster saldo</h2>

          <label className="label">
            <span>Legg til eller trekk fra</span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoAdjust}
              onChange={(e) => setSaldoAdjust(e.target.value)}
              placeholder="f.eks. 500 eller -250"
            />
          </label>

          <div className="cardActions">
            <div className="muted">
              Bruk positivt tall for å øke saldo og negativt for å redusere den.
            </div>

            <button className="btn btnPrimary" type="button" onClick={handleSaldoAdjust}>
              Oppdater saldo
            </button>
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
            Dette er tryggeste måten å bevare data på akkurat nå.
          </div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Status</h2>

          <div className="dataList">
            <div className="itemRow">
              <div>Innkjøp</div>
              <div style={{ fontWeight: 700 }}>{backup.purchases.length}</div>
            </div>

            <div className="itemRow">
              <div>Gjeldsposter</div>
              <div style={{ fontWeight: 700 }}>{debts.length}</div>
            </div>

            <div className="itemRow">
              <div>Eksportformat</div>
              <div className="badge badgeBlue">v{backup.version}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Forklaring</h2>

          <div className="featureList">
            <div className="featureRow">
              <div className="customerMain">
                <div className="featureRowTitle">Utestående salg</div>
                <div className="featureRowSub">
                  Restbeløp på salg som kunder ikke har betalt ferdig.
                </div>
              </div>
            </div>

            <div className="featureRow">
              <div className="customerMain">
                <div className="featureRowTitle">Gjeld / lån til gode</div>
                <div className="featureRowSub">
                  Egen gjeldspost som ikke kommer fra salg, som lån eller forskudd.
                </div>
              </div>
            </div>

            <div className="featureRow">
              <div className="customerMain">
                <div className="featureRowTitle">Potensiell totalverdi</div>
                <div className="featureRowSub">
                  Saldo + samlet til gode + lagerverdi.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message ? <div style={{ marginTop: 16, color: "#86efac" }}>{message}</div> : null}

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
