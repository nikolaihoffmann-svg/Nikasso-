import { useMemo, useRef, useState } from "react";
import {
  adjustSaldo,
  changeAppPassword,
  changePanicPin,
  clearAllData,
  downloadBackup,
  exportAllData,
  fmtKr,
  hasAppPassword,
  hasPanicPin,
  importBackupFile,
  inventoryValue,
  removeAppPassword,
  removePanicPin,
  setAppPassword,
  setPanicPin,
  setSaldo,
  totalDebtOutstanding,
  totalReceivables,
  totalSalesOutstanding,
  verifyAppPassword,
  verifyPanicPin,
} from "../app/storage";

const SESSION_UNLOCK_KEY = "nikasso_unlocked_session_v1";

function parseNoNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function visibleMessage(text: string): string {
  return text.replace(/\s\d+$/, "");
}

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [message, setMessage] = useState("");
  const [saldoAdjust, setSaldoAdjust] = useState("");
  const [saldoSetValue, setSaldoSetValue] = useState("");

  const [newPin, setNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [removePinValue, setRemovePinValue] = useState("");

  const [newPanicPin, setNewPanicPin] = useState("");
  const [currentPanicPin, setCurrentPanicPin] = useState("");
  const [nextPanicPin, setNextPanicPin] = useState("");
  const [removePanicPinValue, setRemovePanicPinValue] = useState("");

  const backup = useMemo(() => exportAllData(), [message]);
  const debts = backup.debts ?? [];
  const pinEnabled = hasAppPassword();
  const panicPinEnabled = hasPanicPin();

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

  function refreshMessage(text: string): void {
    setMessage(`${text} ${Date.now()}`);
  }

  function handleSaldoAdjust(direction: 1 | -1): void {
    const amount = parseNoNumber(saldoAdjust);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const signed = direction === 1 ? amount : -amount;
    adjustSaldo(signed);
    setSaldoAdjust("");
    refreshMessage(`Saldo justert ${direction === 1 ? "opp" : "ned"}`);
  }

  function handleSaldoSet(): void {
    const amount = parseNoNumber(saldoSetValue);
    if (!Number.isFinite(amount)) return;

    setSaldo(amount);
    setSaldoSetValue("");
    refreshMessage("Saldo satt direkte");
  }

  function handleCreatePin(): void {
    try {
      if (newPin.length !== 4) {
        setMessage("PIN må være 4 sifre");
        return;
      }

      setAppPassword(newPin);
      setNewPin("");
      refreshMessage("PIN opprettet");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke opprette PIN");
    }
  }

  function handleChangePin(): void {
    try {
      if (currentPin.length !== 4 || nextPin.length !== 4) {
        setMessage("Begge PIN-feltene må være 4 sifre");
        return;
      }

      changeAppPassword(currentPin, nextPin);
      setCurrentPin("");
      setNextPin("");
      refreshMessage("PIN endret");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke endre PIN");
    }
  }

  function handleRemovePin(): void {
    try {
      if (removePinValue.length !== 4) {
        setMessage("Skriv inn gjeldende PIN");
        return;
      }

      if (!verifyAppPassword(removePinValue)) {
        setMessage("Feil PIN");
        return;
      }

      removeAppPassword();
      setRemovePinValue("");
      sessionStorage.removeItem(SESSION_UNLOCK_KEY);
      refreshMessage("PIN fjernet");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke fjerne PIN");
    }
  }

  function handleCreatePanicPin(): void {
    try {
      if (newPanicPin.length !== 4) {
        setMessage("Reserve-PIN må være 4 sifre");
        return;
      }

      setPanicPin(newPanicPin);
      setNewPanicPin("");
      refreshMessage("Reserve-PIN lagret");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke lagre reserve-PIN");
    }
  }

  function handleChangePanicPin(): void {
    try {
      if (currentPanicPin.length !== 4 || nextPanicPin.length !== 4) {
        setMessage("Begge reserve-PIN-feltene må være 4 sifre");
        return;
      }

      changePanicPin(currentPanicPin, nextPanicPin);
      setCurrentPanicPin("");
      setNextPanicPin("");
      refreshMessage("Reserve-PIN endret");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke endre reserve-PIN");
    }
  }

  function handleRemovePanicPin(): void {
    try {
      if (removePanicPinValue.length !== 4) {
        setMessage("Skriv inn gjeldende reserve-PIN");
        return;
      }

      if (!verifyPanicPin(removePanicPinValue)) {
        setMessage("Feil reserve-PIN");
        return;
      }

      removePanicPin();
      setRemovePanicPinValue("");
      refreshMessage("Reserve-PIN fjernet");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kunne ikke fjerne reserve-PIN");
    }
  }

  function handleLockNow(): void {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    window.location.reload();
  }

  const salesOpen = totalSalesOutstanding();
  const debtsOpen = totalDebtOutstanding();
  const receivables = totalReceivables();
  const stockValue = inventoryValue(backup.items ?? []);
  const potentialTotal = (backup.saldo ?? 0) + receivables + stockValue;

  return (
    <div>
      <h1 className="pageTitle">Data</h1>
      <p className="pageLead">Backup, status, saldo, verdi og app-lås på ett sted.</p>

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
          <h2 className="sectionTitle">Sett saldo direkte</h2>

          <label className="label">
            <span>Ny saldo</span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoSetValue}
              onChange={(e) => setSaldoSetValue(e.target.value)}
              placeholder="F.eks. 12500"
            />
          </label>

          <div className="cardActions">
            <div className="muted">Dette overskriver nåværende saldo.</div>
            <button className="btn btnPrimary" type="button" onClick={handleSaldoSet}>
              Sett saldo
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Juster saldo</h2>

          <label className="label">
            <span>Beløp</span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoAdjust}
              onChange={(e) => setSaldoAdjust(e.target.value)}
              placeholder="F.eks. 500"
            />
          </label>

          <div className="dataActionRow">
            <button className="btn" type="button" onClick={() => handleSaldoAdjust(-1)}>
              − Trekk fra
            </button>
            <button className="btn btnPrimary" type="button" onClick={() => handleSaldoAdjust(1)}>
              + Legg til
            </button>
          </div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">PIN-lås</h2>

          {!pinEnabled ? (
            <>
              <label className="label">
                <span>Ny 4-sifret PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="cardActions">
                <div className="muted">Appen låses når den går i bakgrunnen og etter 5 min uten bruk.</div>
                <button className="btn btnPrimary" type="button" onClick={handleCreatePin}>
                  Opprett PIN
                </button>
              </div>
            </>
          ) : (
            <div className="featureList">
              <div className="featureRow">
                <div className="customerMain">
                  <div className="featureRowTitle">PIN-lås aktiv</div>
                  <div className="featureRowSub">Appen låser ved bakgrunn og automatisk etter 5 min.</div>
                </div>
                <div className="featureRowRight">
                  <span className="badge badgeSuccess">Aktiv</span>
                </div>
              </div>

              <label className="label">
                <span>Nåværende PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <label className="label">
                <span>Ny PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={nextPin}
                  onChange={(e) => setNextPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="dataActionRow">
                <button className="btn btnPrimary" type="button" onClick={handleChangePin}>
                  Endre PIN
                </button>
                <button className="btn" type="button" onClick={handleLockNow}>
                  Lås appen nå
                </button>
              </div>

              <label className="label" style={{ marginTop: 10 }}>
                <span>Fjern PIN (skriv nåværende)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={removePinValue}
                  onChange={(e) => setRemovePinValue(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="cardActions">
                <div className="muted">Fjerner låsen fra denne enheten.</div>
                <button className="btn btnDanger" type="button" onClick={handleRemovePin}>
                  Fjern PIN
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="sectionTitle">Reserve-PIN</h2>

          {!pinEnabled ? (
            <div className="cardSub">Opprett vanlig PIN først.</div>
          ) : !panicPinEnabled ? (
            <>
              <label className="label">
                <span>Ny 4-sifret reserve-PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPanicPin}
                  onChange={(e) => setNewPanicPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="cardActions">
                <div className="muted">Reserve-PIN må være forskjellig fra vanlig PIN.</div>
                <button className="btn btnPrimary" type="button" onClick={handleCreatePanicPin}>
                  Lagre reserve-PIN
                </button>
              </div>
            </>
          ) : (
            <div className="featureList">
              <div className="featureRow">
                <div className="customerMain">
                  <div className="featureRowTitle">Reserve-PIN aktiv</div>
                  <div className="featureRowSub">Egen PIN er lagret separat fra vanlig PIN.</div>
                </div>
                <div className="featureRowRight">
                  <span className="badge badgeGold">Aktiv</span>
                </div>
              </div>

              <label className="label">
                <span>Nåværende reserve-PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={currentPanicPin}
                  onChange={(e) => setCurrentPanicPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <label className="label">
                <span>Ny reserve-PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={nextPanicPin}
                  onChange={(e) => setNextPanicPin(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="dataActionRow">
                <button className="btn btnPrimary" type="button" onClick={handleChangePanicPin}>
                  Endre reserve-PIN
                </button>
              </div>

              <label className="label" style={{ marginTop: 10 }}>
                <span>Fjern reserve-PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={removePanicPinValue}
                  onChange={(e) => setRemovePanicPinValue(onlyDigits(e.target.value))}
                  placeholder="••••"
                  maxLength={4}
                />
              </label>

              <div className="cardActions">
                <div className="muted">Fjerner bare reserve-PIN.</div>
                <button className="btn btnDanger" type="button" onClick={handleRemovePanicPin}>
                  Fjern reserve-PIN
                </button>
              </div>
            </div>
          )}
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
            Dette er tryggeste måten å bevare data på akkurat nå.
          </div>
        </div>

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
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
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

            <div className="featureRow">
              <div className="customerMain">
                <div className="featureRowTitle">Auto-lås</div>
                <div className="featureRowSub">
                  Appen låses ved bakgrunn og etter 5 minutter uten aktivitet.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Fareområde</h2>

          <div className="rowBetween">
            <div className="cardSub" style={{ marginTop: 0 }}>
              Bruk dette kun hvis du allerede har eksportert backup først.
            </div>

            <button
              className="btn btnDanger"
              type="button"
              onClick={() => {
                if (confirm("Slette all lokal data?")) {
                  clearAllData();
                  sessionStorage.removeItem(SESSION_UNLOCK_KEY);
                  window.location.reload();
                }
              }}
            >
              Nullstill alt
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <div style={{ marginTop: 16, color: "#86efac" }}>{visibleMessage(message)}</div>
      ) : null}
    </div>
  );
} 
