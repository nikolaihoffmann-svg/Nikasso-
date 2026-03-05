// src/pages/Gjeld.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  uid,
  useReceivables,
  receivablePaidSum,
  receivableRemaining,
  Receivable,
} from "../app/storage";

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
  const { receivables, upsert, remove, addPayment, removePayment, setPaid } = useReceivables();

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
      const hay = `${r.debtorName} ${r.title ?? ""} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
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
    const n = debtorName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(amount);
    if (a <= 0) return alert("Beløp må være over 0.");

    const t = title.trim() || "Gjeld";

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

    // lag ISO ved "midt på dagen" for å unngå tidsone-krøll
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;

    // ✅ riktig rekkefølge: (id, amount, dateIso?, note?)
    addPayment(payFor.id, a, iso, payNote.trim() || undefined);
    setPayFor(null);
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld til meg</div>
      <div className="cardSub">
        Utestående: <b>{fmtKr(stats.totalRemaining)}</b> • Forfalt (utestående): <b>{fmtKr(stats.overdueRemaining)}</b> • Innbetalt:{" "}
        <b>{fmtKr(stats.totalPaid)}</b> • Totalt opprettet: <b>{fmtKr(stats.totalOriginal)}</b>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til gjeld</div>
        <div className="fieldGrid">
          <div className="row3">
            <div>
              <label className="label">Tittel</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks. Lån, Faktura, Diverse" />
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
            <div style={{ gridColumn: "span 2" as any }}>
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
          const paid = receivablePaidSum(r);
          const rem = Math.max(0, receivableRemaining(r));
          const overdue = rem > 0 && isOverdue(r.dueDate);

          return (
            <div key={r.id} className={overdue ? "item low" : "item"}>
              <div className="itemTop">
                <div>
                  <p className="itemTitle">
                    {r.debtorName} • {r.title}
                  </p>

                  <div className="itemMeta">
                    Opprinnelig: <b>{fmtKr(r.amount)}</b> • Innbetalt: <b>{fmtKr(paid)}</b> • Gjenstår: <b>{fmtKr(rem)}</b>
                    {r.dueDate ? (
                      <>
                        {" "}
                        • Forfall: <b>{new Date(r.dueDate).toLocaleDateString("nb-NO")}</b>
                      </>
                    ) : null}{" "}
                    • Status: <b>{rem <= 0 ? "Betalt" : overdue ? "Forfalt" : "Utestående"}</b>
                  </div>

                  {r.note ? (
                    <div className="itemMeta">
                      Notat: <b>{r.note}</b>
                    </div>
                  ) : null}

                  {Array.isArray(r.payments) && r.payments.length > 0 ? (
                    <div className="itemMeta" style={{ marginTop: 10 }}>
                      <b>Innbetalinger:</b>
                      {r.payments
                        .slice()
                        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                        .map((p) => (
                          <div key={p.id} style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span>
                              • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                              {p.note ? <> ({p.note})</> : null}
                            </span>
                            <button className="btn btnGhost" type="button" onClick={() => removePayment(r.id, p.id)}>
                              Slett innbetaling
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="itemActions">
                <button className="btn btnPrimary" type="button" onClick={() => openPayment(r)}>
                  Registrer innbetaling
                </button>

                {rem > 0 ? (
                  <button className="btn" type="button" onClick={() => setPaid(r.id, true)}>
                    Sett ferdig betalt
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => setPaid(r.id, false)}>
                    Gjør ubetalt
                  </button>
                )}

                <button
                  className="btn btnDanger"
                  type="button"
                  onClick={() => {
                    if (confirm(`Slette "${r.debtorName} • ${r.title}"?`)) remove(r.id);
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
                {payFor.debtorName} • {payFor.title}
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
