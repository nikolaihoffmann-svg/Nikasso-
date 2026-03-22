// src/pages/Gjeld.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  uid,
  useReceivables,
  receivablePaidSum,
  receivableRemaining,
  Receivable,
  round2,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseDateOnly(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isOverdue(dueDate?: string) {
  const d = parseDateOnly(dueDate);
  if (!d) return false;
  const now = new Date();
  // sammenlign kun dato (midt på dagen brukt i parse)
  return d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
}

function daysUntil(dueDate?: string) {
  const d = parseDateOnly(dueDate);
  if (!d) return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const diff = d.getTime() - base.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dueBadge(dueDate?: string) {
  const n = daysUntil(dueDate);
  if (n === null) return null;
  if (n < 0) return { cls: "danger" as const, text: `Forfalt (${Math.abs(n)}d)` };
  if (n === 0) return { cls: "warn" as const, text: "Forfaller i dag" };
  if (n <= 7) return { cls: "warn" as const, text: `Forfaller om ${n}d` };
  return { cls: "" as const, text: `Forfaller om ${n}d` };
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
  const { receivables, upsert, remove, addPayment, removePayment } = useReceivables();

  // filters
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // add/edit
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("Gjeld");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [active, setActive] = useState<Receivable | null>(null);

  // payment
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const stats = useMemo(() => {
    const totalOriginal = round2(receivables.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const totalPaid = round2(receivables.reduce((a, r) => a + receivablePaidSum(r), 0));
    const totalRemaining = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));
    const overdueRemaining = round2(
      receivables.reduce((a, r) => {
        const rem = Math.max(0, receivableRemaining(r));
        if (rem > 0 && isOverdue(r.dueDate)) return a + rem;
        return a;
      }, 0)
    );
    return { totalOriginal, totalPaid, totalRemaining, overdueRemaining };
  }, [receivables]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let list = receivables.slice();

    // filter
    if (qq) {
      list = list.filter((r) => {
        const hay = `${r.title ?? ""} ${r.debtorName ?? ""} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    if (onlyOpen) list = list.filter((r) => Math.max(0, receivableRemaining(r)) > 0);
    if (onlyOverdue) list = list.filter((r) => Math.max(0, receivableRemaining(r)) > 0 && isOverdue(r.dueDate));

    // sort: overdue first, then highest remaining, then name
    list.sort((a, b) => {
      const ar = Math.max(0, receivableRemaining(a));
      const br = Math.max(0, receivableRemaining(b));
      const ao = ar > 0 && isOverdue(a.dueDate);
      const bo = br > 0 && isOverdue(b.dueDate);
      if (ao !== bo) return ao ? -1 : 1;
      if (br !== ar) return br - ar;
      return (a.debtorName || "").localeCompare(b.debtorName || "", "nb-NO", { sensitivity: "base" });
    });

    return list;
  }, [receivables, q, onlyOpen, onlyOverdue]);

  function openAdd() {
    setTitle("Gjeld");
    setDebtorName("");
    setAmount("0");
    setDueDate("");
    setNote("");
    setAddOpen(true);
  }

  function saveAdd() {
    const n = debtorName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(amount);
    if (a <= 0) return alert("Beløp må være over 0.");

    upsert({
      id: uid("rcv"),
      title: title.trim() ? title.trim() : "Gjeld",
      debtorName: n,
      amount: round2(a),
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      payments: [],
    } as any);

    setAddOpen(false);
  }

  function openDetails(r: Receivable) {
    setActive(r);
    setDetailsOpen(true);
  }

  function openPay(r: Receivable) {
    setActive(r);
    setPayAmount(String(Math.max(0, receivableRemaining(r)) || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayOpen(true);
  }

  function savePay() {
    if (!active) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Innbetaling må være over 0.");
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;
    addPayment(active.id, round2(a), payNote.trim() || undefined, iso);
    setPayOpen(false);
  }

  function statusBadge(r: Receivable) {
    const rem = Math.max(0, receivableRemaining(r));
    if (rem <= 0) return <span className="badge success">Betalt</span>;
    if (isOverdue(r.dueDate)) return <span className="badge danger">Forfalt</span>;
    return <span className="badge danger">Utestående</span>;
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld til meg</div>
      <div className="cardSub">Kompakt liste. Trykk en rad for detaljer.</div>

      <div className="metricGrid">
        <div className="metricCard">
          <div className="metricTitle">Utestående</div>
          <div className="metricValue">{fmtKr(stats.totalRemaining)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Forfalt (utestående)</div>
          <div className="metricValue">{fmtKr(stats.overdueRemaining)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Innbetalt</div>
          <div className="metricValue">{fmtKr(stats.totalPaid)}</div>
        </div>
      </div>

      <div className="btnRow" style={{ justifyContent: "space-between" }}>
        <button className="btn btnPrimary" type="button" onClick={openAdd}>
          + Ny gjeld
        </button>

        <div className="btnRow" style={{ marginTop: 0 }}>
          <button className="btn" type="button" onClick={() => setOnlyOpen((v) => !v)}>
            {onlyOpen ? "Vis alle" : "Vis utestående"}
          </button>
          <button className="btn" type="button" onClick={() => setOnlyOverdue((v) => !v)}>
            {onlyOverdue ? "Alle frister" : "Kun forfalt"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i gjeld..." />
      </div>

      {/* LIST (single level – no nested cards) */}
      <div className="list">
        {filtered.map((r) => {
          const rem = Math.max(0, receivableRemaining(r));
          const due = dueBadge(r.dueDate);

          return (
            <div key={r.id} className="rowItem" onClick={() => openDetails(r)} role="button" tabIndex={0}>
              <div style={{ minWidth: 0 }}>
                <div className="rowItemTitle" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.debtorName}</span>
                  {statusBadge(r)}
                  {due && rem > 0 ? <span className={`badge ${due.cls}`}>{due.text}</span> : null}
                </div>

                <div className="rowItemSub">
                  Gjenstår:{" "}
                  <b className={rem > 0 ? "dangerText" : "successText"}>
                    {fmtKr(rem)}
                  </b>
                  {r.title ? (
                    <>
                      {" "}
                      • <span style={{ opacity: 0.9 }}>{r.title}</span>
                    </>
                  ) : null}
                  {r.dueDate ? (
                    <>
                      {" "}
                      • Forfall: <b>{r.dueDate}</b>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* quick pay */}
                {rem > 0 ? (
                  <button
                    className="iconBtn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPay(r);
                    }}
                    aria-label="Registrer innbetaling"
                    title="Registrer innbetaling"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? <div className="item">Ingen treff.</div> : null}
      </div>

      {/* ADD */}
      <Modal open={addOpen} title="Ny gjeld" onClose={() => setAddOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div className="row3">
            <div>
              <label className="label">Tittel</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gjeld / Lån / Faktura ..." />
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
              <label className="label">Forfall (valgfritt)</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2" } as any}>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setAddOpen(false)}>
              Avbryt
            </button>
            <button className="btn btnPrimary" type="button" onClick={saveAdd}>
              Lagre
            </button>
          </div>
        </div>
      </Modal>

      {/* DETAILS */}
      <Modal open={detailsOpen} title="Detaljer" onClose={() => setDetailsOpen(false)}>
        {active ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="item">
              <div className="itemTop" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="itemTitle" style={{ marginBottom: 6 }}>
                    {active.debtorName}
                  </div>

                  <div className="itemMeta">
                    {active.title ? (
                      <>
                        <b>{active.title}</b> {" • "}
                      </>
                    ) : null}
                    Status: {statusBadge(active)}
                  </div>

                  <div className="itemMeta" style={{ marginTop: 8 }}>
                    Opprinnelig: <b>{fmtKr(active.amount)}</b>
                    {" • "}Innbetalt: <b>{fmtKr(receivablePaidSum(active))}</b>
                    {" • "}Gjenstår:{" "}
                    <b className={Math.max(0, receivableRemaining(active)) > 0 ? "dangerText" : "successText"}>
                      {fmtKr(Math.max(0, receivableRemaining(active)))}
                    </b>
                  </div>

                  {active.dueDate ? (
                    <div className="itemMeta" style={{ marginTop: 6 }}>
                      Forfall: <b>{active.dueDate}</b>{" "}
                      {dueBadge(active.dueDate) && Math.max(0, receivableRemaining(active)) > 0 ? (
                        <span className={`badge ${dueBadge(active.dueDate)!.cls}`} style={{ marginLeft: 8 }}>
                          {dueBadge(active.dueDate)!.text}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {active.note ? (
                    <div className="itemMeta" style={{ marginTop: 6 }}>
                      Notat: <b>{active.note}</b>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="btnRow" style={{ marginTop: 12 }}>
                {Math.max(0, receivableRemaining(active)) > 0 ? (
                  <button className="btn btnPrimary" type="button" onClick={() => openPay(active)}>
                    Registrer innbetaling
                  </button>
                ) : (
                  <button className="btn" type="button" disabled>
                    Betalt
                  </button>
                )}

                <button
                  className="btn btnDanger"
                  type="button"
                  onClick={() => {
                    if (confirm(`Slette "${active.debtorName}"?`)) {
                      remove(active.id);
                      setDetailsOpen(false);
                    }
                  }}
                >
                  Slett
                </button>
              </div>
            </div>

            <div className="card" style={{ marginTop: 0 }}>
              <div className="cardTitle">Innbetalinger</div>
              <div className="cardSub">Klikk “x” for å fjerne en feilregistrering.</div>

              <div className="list">
                {Array.isArray(active.payments) && active.payments.length > 0 ? (
                  active.payments
                    .slice()
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((p) => (
                      <div key={p.id} className="rowItem" style={{ cursor: "default" }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="rowItemTitle">{fmtKr(p.amount)}</div>
                          <div className="rowItemSub">
                            {new Date(p.createdAt).toLocaleDateString("nb-NO")}
                            {p.note ? <> • {p.note}</> : null}
                          </div>
                        </div>

                        <button
                          className="iconBtn"
                          type="button"
                          aria-label="Fjern innbetaling"
                          title="Fjern innbetaling"
                          onClick={() => {
                            if (confirm("Fjerne denne innbetalingen?")) removePayment(active.id, p.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                ) : (
                  <div className="item">Ingen innbetalinger registrert.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* PAY */}
      <Modal open={payOpen} title="Registrer innbetaling" onClose={() => setPayOpen(false)}>
        {active ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>{active.debtorName}</b> • Gjenstår nå: <b>{fmtKr(Math.max(0, receivableRemaining(active)))}</b>
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

            <div className="btnRow" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={() => setPayOpen(false)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={savePay}>
                Lagre
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
