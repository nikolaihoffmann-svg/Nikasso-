// src/pages/Gjeld.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fmtKr,
  receivablePaidSum,
  receivableRemaining,
  Receivable,
  round2,
  uid,
  useReceivables,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isOverdue(dueDate?: string) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (!Number.isFinite(d.getTime())) return false;
  // dato uten klokkeslett: gjør den “forfalt” dagen etter kl 00-ish
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
        {/* ✅ Viktig: gjør modal-body scrollbar på mobil */}
        <div className="modalBody" style={{ maxHeight: "75vh", overflow: "auto" }}>
          {props.children}
        </div>
      </div>
    </div>
  );
}

function ChoiceModal(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;

  primaryText: string;
  onPrimary: () => void;

  secondaryText: string;
  onSecondary: () => void;

  cancelText: string;
  onCancel: () => void;
}) {
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

        <div className="modalBody" style={{ maxHeight: "75vh", overflow: "auto" }}>
          {props.children}

          <div className="btnRow" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={props.onCancel}>
              {props.cancelText}
            </button>
            <button className="btn btnDanger" type="button" onClick={props.onSecondary}>
              {props.secondaryText}
            </button>
            <button className="btn btnPrimary" type="button" onClick={props.onPrimary}>
              {props.primaryText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusFor(r: Receivable) {
  const rem = Math.max(0, receivableRemaining(r));
  const overdue = rem > 0 && isOverdue(r.dueDate);
  const paid = rem <= 0 || Boolean((r as any).paid);
  return { rem, overdue, paid };
}

export function Gjeld() {
  const { receivables, upsert, remove, addPayment } = useReceivables();

  // filters / paging / accordion
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleCount(5);
    setOpenId(null);
  }, [onlyOpen, onlyOverdue, q]);

  // NEW modal
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState("Gjeld");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  // payment modal
  const [payFor, setPayFor] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  // edit modal
  const [edit, setEdit] = useState<Receivable | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eName, setEName] = useState("");
  const [eAmount, setEAmount] = useState("0");
  const [eDue, setEDue] = useState("");
  const [eNote, setENote] = useState("");

  // delete modal
  const [del, setDel] = useState<Receivable | null>(null);

  const stats = useMemo(() => {
    const totalOriginal = receivables.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const totalPaid = receivables.reduce((a, r) => a + receivablePaidSum(r), 0);
    const totalRemaining = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);

    const overdueRemaining = receivables.reduce((a, r) => {
      const rem = Math.max(0, receivableRemaining(r));
      if (rem > 0 && isOverdue(r.dueDate)) return a + rem;
      return a;
    }, 0);

    return {
      totalOriginal: round2(totalOriginal),
      totalPaid: round2(totalPaid),
      totalRemaining: round2(totalRemaining),
      overdueRemaining: round2(overdueRemaining),
    };
  }, [receivables]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let list = receivables.slice();

    if (qq) {
      list = list.filter((r) => {
        const hay = `${r.title ?? ""} ${r.debtorName ?? ""} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    if (onlyOpen) {
      list = list.filter((r) => Math.max(0, receivableRemaining(r)) > 0);
    }

    if (onlyOverdue) {
      list = list.filter((r) => {
        const rem = Math.max(0, receivableRemaining(r));
        return rem > 0 && isOverdue(r.dueDate);
      });
    }

    // sort: overdue first, then highest remaining, then newest updatedAt/createdAt
    list.sort((a, b) => {
      const sa = statusFor(a);
      const sb = statusFor(b);
      if (sa.overdue !== sb.overdue) return sa.overdue ? -1 : 1;
      if (sb.rem !== sa.rem) return sb.rem - sa.rem;
      const au = (a.updatedAt || a.createdAt || "");
      const bu = (b.updatedAt || b.createdAt || "");
      return bu.localeCompare(au);
    });

    return list;
  }, [receivables, q, onlyOpen, onlyOverdue]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  function openNew() {
    setTitle("Gjeld");
    setDebtorName("");
    setAmount("0");
    setDueDate("");
    setNote("");
    setNewOpen(true);
  }

  function saveNew() {
    const n = debtorName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(amount);
    if (a <= 0) return alert("Beløp må være over 0.");

    upsert({
      id: uid("rcv"),
      title: title.trim() ? title.trim() : "Gjeld",
      debtorName: n,
      amount: a,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      payments: [],
    } as any);

    setNewOpen(false);
  }

  function toggleOpen(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }

  function openPayment(r: Receivable) {
    const rem = Math.max(0, receivableRemaining(r));
    setPayFor(r);
    setPayAmount(String(rem || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  function savePayment() {
    if (!payFor) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Innbetaling må være over 0.");

    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;
    addPayment(payFor.id, a, payNote.trim() || undefined, iso);
    setPayFor(null);
  }

  function markPaid(r: Receivable) {
    const rem = Math.max(0, receivableRemaining(r));
    if (rem <= 0) return;
    const iso = new Date().toISOString();
    addPayment(r.id, rem, "Markert betalt", iso);
  }

  function openEdit(r: Receivable) {
    setEdit(r);
    setETitle(r.title ?? "Gjeld");
    setEName(r.debtorName ?? "");
    setEAmount(String(r.amount ?? 0));
    setEDue(r.dueDate ?? "");
    setENote(r.note ?? "");
  }

  function saveEdit() {
    if (!edit) return;

    const n = eName.trim();
    if (!n) return alert("Navn kan ikke være tomt.");
    const a = toNum(eAmount);
    if (a <= 0) return alert("Beløp må være over 0.");

    upsert({
      ...edit,
      title: eTitle.trim() ? eTitle.trim() : "Gjeld",
      debtorName: n,
      amount: a,
      dueDate: eDue.trim() ? eDue.trim() : undefined,
      note: eNote.trim() ? eNote.trim() : undefined,
      payments: Array.isArray(edit.payments) ? edit.payments : [],
    } as any);

    setEdit(null);
  }

  function askDelete(r: Receivable) {
    setDel(r);
  }

  function doDelete() {
    if (!del) return;
    remove(del.id);
    setDel(null);
    setOpenId(null);
  }

  function showMore() {
    setVisibleCount((n) => Math.min(filtered.length, n + 10));
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld</div>
      <div className="cardSub">
        Utestående: <b className="dangerText">{fmtKr(stats.totalRemaining)}</b> • Forfalt:{" "}
        <b className="warnText">{fmtKr(stats.overdueRemaining)}</b> • Innbetalt: <b className="successText">{fmtKr(stats.totalPaid)}</b> • Totalt:
        <b> {fmtKr(stats.totalOriginal)}</b>
      </div>

      <div className="btnRow" style={{ justifyContent: "space-between" }}>
        <button className="btn btnPrimary" type="button" onClick={openNew}>
          + Ny gjeld
        </button>

        <div className="btnRow" style={{ marginTop: 0 }}>
          <button className="btn" type="button" onClick={() => setOnlyOpen((v) => !v)}>
            {onlyOpen ? "Vis alle" : "Kun utestående"}
          </button>
          <button className="btn" type="button" onClick={() => setOnlyOverdue((v) => !v)}>
            {onlyOverdue ? "Vis alt" : "Kun forfalt"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i gjeld (navn, tittel, notat…)" />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardTitle">Liste</div>
        <div className="cardSub">
          Viser <b>{Math.min(visibleCount, filtered.length)}</b> av <b>{filtered.length}</b>
        </div>

        <div className="list">
          {visible.map((r) => {
            const { rem, overdue, paid } = statusFor(r);
            const paidSum = receivablePaidSum(r);

            const statusText = paid ? "Betalt" : overdue ? "Forfalt" : "Utestående";
            const statusClass = paid ? "successText" : overdue ? "warnText" : "dangerText";

            const isOpen = openId === r.id;

            const titleText = r.title ? r.title : "Gjeld";
            const rightBadge = paid ? "Betalt" : overdue ? "Forfalt" : "Utestående";

            return (
              <div key={r.id} className="item">
                {/* compact row */}
                <div className="rowItem" onClick={() => toggleOpen(r.id)} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
                  <div>
                    <p className="rowItemTitle">{r.debtorName || "Ukjent"}</p>
                    <div className="rowItemSub">
                      <b>{fmtKr(rem)}</b> gjenstår • <span className={statusClass}>{statusText}</span> • {titleText}
                      {r.dueDate ? <> • Forfall {r.dueDate}</> : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={`badge ${paid ? "success" : overdue ? "warn" : "danger"}`}>{rightBadge}</span>
                    <span className="badge">{isOpen ? "−" : "+"}</span>
                  </div>
                </div>

                {/* details */}
                {isOpen ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="itemMeta">
                      Opprinnelig: <b>{fmtKr(r.amount)}</b> • Innbetalt:{" "}
                      <b className={paid ? "successText" : ""}>{fmtKr(paidSum)}</b> • Gjenstår:{" "}
                      <b className={rem > 0 ? "dangerText" : "successText"}>{fmtKr(rem)}</b>
                    </div>

                    {r.note ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        Notat: <b>{r.note}</b>
                      </div>
                    ) : null}

                    {Array.isArray(r.payments) && r.payments.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 10 }}>
                        <b>Innbetalinger:</b>
                        <div style={{ marginTop: 6 }}>
                          {r.payments
                            .slice()
                            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                            .slice(0, 8)
                            .map((p) => (
                              <div key={p.id}>
                                • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                                {p.note ? <> ({p.note})</> : null}
                              </div>
                            ))}
                          {r.payments.length > 8 ? <div style={{ opacity: 0.85, marginTop: 4 }}>… +{r.payments.length - 8} til</div> : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="btnRow" style={{ marginTop: 12 }}>
                      {rem > 0 ? (
                        <button className="btn btnPrimary" type="button" onClick={() => openPayment(r)}>
                          Registrer innbetaling
                        </button>
                      ) : (
                        <button className="btn" type="button" disabled>
                          Betalt
                        </button>
                      )}

                      {rem > 0 ? (
                        <button className="btn" type="button" onClick={() => markPaid(r)}>
                          Marker betalt
                        </button>
                      ) : null}

                      <button className="btn" type="button" onClick={() => openEdit(r)}>
                        Rediger
                      </button>

                      <button className="btn btnDanger" type="button" onClick={() => askDelete(r)}>
                        Slett
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filtered.length === 0 ? <div className="item">Ingen treff.</div> : null}
        </div>

        {filtered.length > visibleCount ? (
          <div className="btnRow" style={{ marginTop: 12, justifyContent: "center" }}>
            <button className="btn" type="button" onClick={showMore}>
              Vis 10 til
            </button>
          </div>
        ) : null}
      </div>

      {/* NEW */}
      <Modal open={newOpen} title="Ny gjeld" onClose={() => setNewOpen(false)}>
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
              <label className="label">Beløp</label>
              <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="row3">
            <div>
              <label className="label">Forfallsdato</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2" } as any}>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setNewOpen(false)}>
              Avbryt
            </button>
            <button className="btn btnPrimary" type="button" onClick={saveNew}>
              Lagre
            </button>
          </div>
        </div>
      </Modal>

      {/* PAYMENT */}
      <Modal open={!!payFor} title="Registrer innbetaling" onClose={() => setPayFor(null)}>
        {payFor ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>{payFor.debtorName}</b> • Gjenstår nå:{" "}
              <b className="dangerText">{fmtKr(Math.max(0, receivableRemaining(payFor)))}</b>
            </div>

            <div className="row3">
              <div>
                <label className="label">Dato</label>
                <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Beløp</label>
                <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Notat</label>
                <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Valgfritt" />
              </div>
            </div>

            <div className="btnRow" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={() => setPayFor(null)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={savePayment}>
                Lagre
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* EDIT */}
      <Modal open={!!edit} title="Rediger gjeld" onClose={() => setEdit(null)}>
        {edit ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="row3">
              <div>
                <label className="label">Tittel</label>
                <input className="input" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Hvem skylder?</label>
                <input className="input" value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div>
                <label className="label">Totalbeløp</label>
                <input className="input" inputMode="decimal" value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
              </div>
            </div>

            <div className="row3">
              <div>
                <label className="label">Forfall</label>
                <input className="input" type="date" value={eDue} onChange={(e) => setEDue(e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" } as any}>
                <label className="label">Notat</label>
                <input className="input" value={eNote} onChange={(e) => setENote(e.target.value)} />
              </div>
            </div>

            <div className="itemMeta">
              Innbetalt: <b className="successText">{fmtKr(receivablePaidSum(edit))}</b> • Gjenstår etter endring:{" "}
              <b className="dangerText">{fmtKr(Math.max(0, round2(toNum(eAmount) - receivablePaidSum(edit))))}</b>
            </div>

            <div className="btnRow" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={() => setEdit(null)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={saveEdit}>
                Lagre
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* DELETE */}
      <ChoiceModal
        open={!!del}
        title="Slette gjeld?"
        onClose={() => setDel(null)}
        cancelText="Avbryt"
        onCancel={() => setDel(null)}
        secondaryText="Slett"
        onSecondary={doDelete}
        primaryText="Avbryt"
        onPrimary={() => setDel(null)}
      >
        {del ? (
          <div className="itemMeta" style={{ marginTop: 0 }}>
            <b>{del.debtorName}</b>
            <br />
            Gjenstår: <b className="dangerText">{fmtKr(Math.max(0, receivableRemaining(del)))}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Dette kan ikke angres.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
