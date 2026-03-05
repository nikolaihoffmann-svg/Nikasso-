// src/pages/Gjeld.tsx
import React, { useMemo, useState } from "react";
import { fmtKr, round2, uid, useCustomers, useReceivables, Receivable } from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
  const { customers } = useCustomers();
  const { receivables, upsert, remove, setPaid } = useReceivables();

  const [debtorName, setDebtorName] = useState("");
  const [pickCustomerId, setPickCustomerId] = useState<string>("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState<string>("");
  const [note, setNote] = useState("");

  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Receivable | null>(null);

  const stats = useMemo(() => {
    const unpaid = receivables.filter((r) => !r.paid);
    const paid = receivables.filter((r) => r.paid);
    const unpaidSum = round2(unpaid.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const paidSum = round2(paid.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    return {
      count: receivables.length,
      unpaidCount: unpaid.length,
      unpaidSum,
      paidCount: paid.length,
      paidSum,
    };
  }, [receivables]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = receivables.slice();
    if (!qq) return list;
    return list.filter((r) => {
      const hay = `${r.debtorName} ${r.note ?? ""} ${r.dueDate ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [receivables, q]);

  function syncDebtorFromCustomer(id: string) {
    setPickCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) setDebtorName(c.name);
  }

  function addReceivable() {
    const n = debtorName.trim();
    if (!n) return alert("Skriv hvem som skylder deg penger.");

    const a = round2(toNum(amount));
    if (a <= 0) return alert("Beløp må være større enn 0.");

    upsert({
      id: uid("rcv"),
      debtorName: n,
      amount: a,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      paid: false,
    });

    setDebtorName("");
    setPickCustomerId("");
    setAmount("0");
    setDueDate("");
    setNote("");
  }

  return (
    <div className="card">
      <div className="cardTitle">Gjeld (til deg)</div>
      <div className="cardSub">
        Utestående: <b>{fmtKr(stats.unpaidSum)}</b> ({stats.unpaidCount} ikke betalt) • Betalt historikk: <b>{fmtKr(stats.paidSum)}</b>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Legg til gjeldspost</div>

        <div className="fieldGrid">
          <div>
            <label className="label">Velg kunde (valgfritt)</label>
            <select className="input" value={pickCustomerId} onChange={(e) => syncDebtorFromCustomer(e.target.value)}>
              <option value="">Ingen</option>
              {customers
                .slice()
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Hvem skylder deg?</label>
            <input className="input" value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Navn (f.eks. Ola Nordmann)" />
          </div>

          <div className="row3">
            <div>
              <label className="label">Beløp (kr)</label>
              <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Forfall (valgfritt)</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Notat (valgfritt)</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="F.eks. lån, deler, osv." />
            </div>
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={addReceivable}>
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
        {filtered.map((r) => (
          <div key={r.id} className={!r.paid ? "item low" : "item"}>
            <div className="itemTop">
              <div>
                <p className="itemTitle">{r.debtorName}</p>
                <div className="itemMeta">
                  Beløp: <b>{fmtKr(r.amount)}</b> • Status: <b>{r.paid ? "Betalt" : "Ikke betalt"}</b>
                  {r.dueDate ? (
                    <>
                      {" "}
                      • Forfall: <b>{r.dueDate}</b>
                    </>
                  ) : null}
                </div>
                {r.note ? <div className="itemMeta" style={{ marginTop: 6 }}>Notat: <b>{r.note}</b></div> : null}
                {!r.paid ? <div className="lowTag">⏳ Utestående</div> : null}
              </div>
            </div>

            <div className="itemActions">
              <button className="btn btnPrimary" type="button" onClick={() => setPaid(r.id, !r.paid)}>
                {r.paid ? "Marker ikke betalt" : "Marker betalt"}
              </button>

              <button className="btn" type="button" onClick={() => setEdit(r)}>
                Rediger
              </button>

              <button
                className="btn btnDanger"
                type="button"
                onClick={() => {
                  if (confirm("Slette denne gjeldsposten?")) remove(r.id);
                }}
              >
                Slett
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? <div className="item">Ingen poster.</div> : null}
      </div>

      <Modal open={!!edit} title="Rediger gjeld" onClose={() => setEdit(null)}>
        {edit ? (
          <EditReceivable
            r={edit}
            onSave={(next) => {
              upsert(next);
              setEdit(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function EditReceivable(props: {
  r: Receivable;
  onSave: (next: Omit<Receivable, "createdAt" | "updatedAt" | "paidAt"> & { paid?: boolean }) => void;
}) {
  const [debtorName, setDebtorName] = useState(props.r.debtorName);
  const [amount, setAmount] = useState(String(props.r.amount ?? 0));
  const [dueDate, setDueDate] = useState(props.r.dueDate ?? "");
  const [note, setNote] = useState(props.r.note ?? "");
  const [paid, setPaid] = useState(Boolean(props.r.paid));

  return (
    <div className="fieldGrid">
      <div>
        <label className="label">Hvem skylder deg?</label>
        <input className="input" value={debtorName} onChange={(e) => setDebtorName(e.target.value)} />
      </div>

      <div className="row3">
        <div>
          <label className="label">Beløp (kr)</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Forfall</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={paid ? "yes" : "no"} onChange={(e) => setPaid(e.target.value === "yes")}>
            <option value="no">Ikke betalt</option>
            <option value="yes">Betalt</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Notat</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="btnRow">
        <button
          className="btn btnPrimary"
          type="button"
          onClick={() => {
            const n = debtorName.trim();
            if (!n) return alert("Navn kan ikke være tomt.");
            const a = round2(toNum(amount));
            if (a <= 0) return alert("Beløp må være > 0.");

            props.onSave({
              id: props.r.id,
              debtorName: n,
              amount: a,
              dueDate: dueDate.trim() ? dueDate.trim() : undefined,
              note: note.trim() ? note.trim() : undefined,
              paid,
            });
          }}
        >
          Lagre
        </button>
      </div>
    </div>
  );
}
