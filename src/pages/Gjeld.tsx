// src/pages/Gjeld.tsx
import React, { useMemo, useState } from "react";
import { fmtKr, uid, useReceivables, receivablePaidSum, receivableRemaining, Receivable } from "../app/storage";

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

function Modal(props: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!props.open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <p className="modalTitle">{props.title}</p>
          <button className="iconBtn" type="button" onClick={props.onClose} aria-label="Lukk">
            ✕
          </button>
        </div>
        <div className="modalBody">{props.children}</div>
      </div>
    </div>
  );
}

export function Gjeld() {
  const { receivables, upsert, remove, addPayment } = useReceivables();

  const [title, setTitle] = useState("Gjeld");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");

  const [payFor, setPayFor] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [payNote, setPayNote] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return receivables;
    return receivables.filter((r) => {
      const hay = `${r.title} ${r.debtorName} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [receivables, q]);

  const stats = useMemo(() => {
    const totalOriginal = receivables.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const totalPaid = receivables.reduce((a, r) => a + receivablePaidSum(r), 0);
    const totalRemaining = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);

    const overdueRemaining = receivables.reduce((a, r) => {
      const rem = Math.max(0, receivableRemaining(r));
      if (rem > 0 && isOverdue(r.dueDate)) return a + rem;
      return a;
    }, 0);

    return { totalOriginal, totalPaid, totalRemaining, overdueRemaining };
  }, [receivables]);

  function add() {
    const t = title.trim() || "Gjeld";
    const n = debtorName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(amount);
    if (a <= 0) return alert("Beløp må være over 0.");

    upsert({
      id: uid("rcv"),
      title: t,
      debtorName: n,
      amount: a,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      payments: [],
    });

    setTitle("Gjeld");
    setDebtorName("");
    setAmount("0");
    setDueDate("");
    setNote("");
  }

  function openPayment(r: Receivable) {
    setPayFor(r);
    setPayAmount(String(Math.max(0, receivableRemaining(r)) || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  function savePayment() {
    if (!payFor) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Innbetaling må være over 0.");

    // ISO ved midt på dagen (stabilt i tidsone)
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;

    // NB: addPayment i storage blir gjort kompatibel (note, dateIso)
    addPayment(payFor.id, a, payNote.trim() || undefined, iso);
    setPayFor(null);
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld til meg</div>
      <div className="cardSub">
        Utestående: <b>{fmtKr(stats.totalRemaining)}</b> • Forfalt: <b>{fmtKr(stats.overdueRemaining)}</b> • Innbetalt:{" "}
        <b>{fmtKr(stats.totalPaid)}</b> • Totalt opprettet: <b>{fmtKr(stats.totalOriginal)}</b>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til gjeld</div>

        <div className="fieldGrid">
          <div className="row3">
            <div>
              <label className="label">Tittel</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks Lån / Faktura / Diverse" />
            </div>
            <div>
              <label className="label">Hvem skylder?</label>
              <input className="input" value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Navn / referanse" />
            </div>
            <div>
              <label className="label">Beløp (kr)</label>
              <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="row3">
            <div>
              <label className="label">Forfallsdato</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
            <div className="btnRow" style={{ alignItems: "flex-end" }}>
              <button className="btn btnPrimary" type="button" onClick={add}>
                + Legg til
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i gjeld..." />

      <div className="list">
        {filtered.map((r) => {
          const paid = receivablePaidSum(r);
          const rem = Math.max(0, receivableRemaining(r));
          const overdue = rem > 0 && isOverdue(r.dueDate);

          return (
            <div key={r.id} className={overdue ? "item low" : "item"}>
              <div className="itemTop">
                <div>
                  <p className="itemTitle">
                    {r.title}: {r.debtorName}
                  </p>

                  <div className="itemMeta">
                    Opprinnelig: <b>{fmtKr(r.amount)}</b> • Innbetalt: <b>{fmtKr(paid)}</b> • Gjenstår: <b>{fmtKr(rem)}</b>
                    {r.dueDate ? (
                      <>
                        {" "}
                        • Forfall: <b>{r.dueDate}</b>
                      </>
                    ) : null}
                    {" "}
                    • Status: <b>{rem <= 0 ? "Betalt" : overdue ? "Forfalt" : "Utestående"}</b>
                  </div>

                  {r.note ? (
                    <div className="itemMeta">
                      Notat: <b>{r.note}</b>
                    </div>
                  ) : null}

                  {Array.isArray(r.payments) && r.payments.length > 0 ? (
                    <div className="itemMeta" style={{ marginTop: 8 }}>
                      <b>Innbetalinger:</b>
                      {r.payments.slice(0, 6).map((p) => (
                        <div key={p.id} style={{ marginTop: 4 }}>
                          • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                          {p.note ? <> ({p.note})</> : null}
                        </div>
                      ))}
                      {r.payments.length > 6 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{r.payments.length - 6} til</div> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="itemActions">
                <button className="btn btnPrimary" type="button" onClick={() => openPayment(r)}>
                  Registrer innbetaling
                </button>

                <button
                  className="btn btnDanger"
                  type="button"
                  onClick={() => {
                    if (confirm(`Slette "${r.title}: ${r.debtorName}"?`)) remove(r.id);
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

      <Modal open={!!payFor} title="Registrer innbetaling" onClose={() => setPayFor(null)}>
        {payFor ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>
                {payFor.title}: {payFor.debtorName}
              </b>{" "}
              • Gjenstår nå: <b>{fmtKr(Math.max(0, receivableRemaining(payFor)))}</b>
            </div>

            <div className="row3">
              <div>
                <label className="label">Dato</label>
                <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Beløp (kr)</label>
                <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Notat</label>
                <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Valgfritt" />
              </div>
            </div>

            <div className="btnRow">
              <button className="btn btnPrimary" type="button" onClick={savePayment}>
                Lagre innbetaling
              </button>
              <button className="btn" type="button" onClick={() => setPayFor(null)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
