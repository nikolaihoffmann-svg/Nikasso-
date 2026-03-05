// src/pages/Gjeld.tsx
import React, { useMemo, useState } from "react";
import { fmtKr, uid, useReceivables, Receivable } from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isOverdue(dueDate?: string) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (!Number.isFinite(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function Gjeld() {
  const { receivables, upsert, remove, setPaid } = useReceivables();

  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState(""); // yyyy-mm-dd
  const [note, setNote] = useState("");

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return receivables;
    return receivables.filter((r) => {
      const hay = `${r.debtorName} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [receivables, q]);

  const stats = useMemo(() => {
    const unpaid = receivables.filter((r) => !r.paid);
    const paid = receivables.filter((r) => r.paid);

    const unpaidTotal = unpaid.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const paidTotal = paid.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const overdueTotal = unpaid.reduce((a, r) => a + (isOverdue(r.dueDate) ? (Number(r.amount) || 0) : 0), 0);

    return {
      count: receivables.length,
      unpaidCount: unpaid.length,
      paidCount: paid.length,
      unpaidTotal,
      paidTotal,
      overdueTotal,
    };
  }, [receivables]);

  function add() {
    const n = debtorName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(amount);
    if (a <= 0) return alert("Beløp må være over 0.");

    upsert({
      id: uid("rcv"),
      debtorName: n,
      amount: a,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      paid: false,
    });

    setDebtorName("");
    setAmount("0");
    setDueDate("");
    setNote("");
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld til meg</div>
      <div className="cardSub">
        Totalt utestående: <b>{fmtKr(stats.unpaidTotal)}</b> • Forfalt (utestående): <b>{fmtKr(stats.overdueTotal)}</b> • Betalt historikk:{" "}
        <b>{fmtKr(stats.paidTotal)}</b>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til gjeld</div>
        <div className="fieldGrid">
          <div>
            <label className="label">Hvem skylder?</label>
            <input className="input" value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Navn / referanse" />
          </div>

          <div className="row3">
            <div>
              <label className="label">Beløp (kr)</label>
              <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Forfallsdato</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={add}>
              + Legg til
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i gjeld..." />
      </div>

      <div className="list">
        {filtered.map((r) => {
          const overdue = !r.paid && isOverdue(r.dueDate);
          return (
            <div key={r.id} className={overdue ? "item low" : "item"}>
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{r.debtorName}</p>
                  <div className="itemMeta">
                    Beløp: <b>{fmtKr(r.amount)}</b> • Status: <b>{r.paid ? "Betalt" : overdue ? "Forfalt" : "Utestående"}</b>
                    {r.dueDate ? (
                      <>
                        {" "}
                        • Forfall: <b>{r.dueDate}</b>
                      </>
                    ) : null}
                  </div>
                  {r.note ? <div className="itemMeta">Notat: <b>{r.note}</b></div> : null}
                </div>
              </div>

              <div className="itemActions">
                <button className="btn btnPrimary" type="button" onClick={() => setPaid(r.id, !r.paid)}>
                  Sett {r.paid ? "utestående" : "betalt"}
                </button>
                <button
                  className="btn btnDanger"
                  type="button"
                  onClick={() => {
                    if (confirm(`Slette "${r.debtorName}"?`)) remove(r.id);
                  }}
                >
                  Slett
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? <div className="item">Ingen treff.</div> : null}
      </div>
    </div>
  );
}
