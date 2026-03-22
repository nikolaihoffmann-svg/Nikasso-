// src/pages/Innkjop.tsx
import React, { useMemo, useState } from "react";
import {
  addPurchase,
  fmtKr,
  getItems,
  payableRemaining,
  uid,
  usePayables,
  usePurchases,
  PurchaseLine,
  round2,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function toInt(v: string) {
  const n = Math.trunc(toNum(v));
  return Number.isFinite(n) ? n : 0;
}

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
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

type DraftLine = { id: string; itemId: string; qty: string; unitCost: string };

function sumDraft(lines: DraftLine[], items: ReturnType<typeof getItems>) {
  return round2(
    lines.reduce((a, l) => {
      const it = items.find((x) => x.id === l.itemId);
      if (!it) return a;
      const q = toInt(l.qty);
      const c = round2(toNum(l.unitCost || String(it.cost ?? 0)));
      return a + round2(q * c);
    }, 0)
  );
}

export function Innkjop() {
  const items = useMemo(() => getItems(), []);
  const { purchases } = usePurchases();
  const { payables, addPayment } = usePayables();

  const [open, setOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [paid, setPaid] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [costMode, setCostMode] = useState<"weighted" | "set_latest" | "keep">("weighted");

  const [lines, setLines] = useState<DraftLine[]>([{ id: uid("dl"), itemId: "", qty: "1", unitCost: "" }]);

  const [showCount, setShowCount] = useState(5);

  // Pay modal
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);

  const spentTotal = useMemo(() => round2(purchases.reduce((a, p) => a + (Number(p.total) || 0), 0)), [purchases]);
  const spent30 = useMemo(
    () => round2(purchases.filter((p) => isAfter(p.createdAt, from30)).reduce((a, p) => a + (Number(p.total) || 0), 0)),
    [purchases, from30]
  );

  const unpaidPayables = useMemo(() => {
    return round2(payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0));
  }, [payables]);

  const draftTotal = useMemo(() => sumDraft(lines, items), [lines, items]);

  function addLine() {
    setLines((prev) => [...prev, { id: uid("dl"), itemId: "", qty: "1", unitCost: "" }]);
  }
  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }
  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function openNew() {
    setSupplierName("");
    setPaid(true);
    setDueDate("");
    setNote("");
    setCostMode("weighted");
    setLines([{ id: uid("dl"), itemId: "", qty: "1", unitCost: "" }]);
    setOpen(true);
  }

  function save() {
    const clean: PurchaseLine[] = [];
    const itemsNow = getItems();

    for (const dl of lines) {
      const it = itemsNow.find((x) => x.id === dl.itemId);
      if (!it) continue;
      const q = toInt(dl.qty);
      if (q <= 0) continue;
      const c = round2(toNum(dl.unitCost || String(it.cost ?? 0)));
      if (c <= 0) continue;

      clean.push({
        id: uid("pl"),
        itemId: it.id,
        itemName: it.name,
        qty: q,
        unitCost: c,
      });
    }

    if (clean.length === 0) return alert("Legg til minst én varelinje med vare + antall + kost.");

    addPurchase({
      supplierName: supplierName.trim() ? supplierName.trim() : undefined,
      lines: clean,
      paid,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      costMode,
      payableTitle: "Innkjøp",
    });

    setOpen(false);
  }

  const visible = useMemo(() => purchases.slice(0, showCount), [purchases, showCount]);

  function openPay(payableId: string) {
    const p = payables.find((x) => x.id === payableId);
    if (!p) return;
    setPayId(payableId);
    setPayAmount(String(Math.max(0, payableRemaining(p)) || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  function savePay() {
    if (!payId) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Beløp må være over 0.");
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;
    addPayment(payId, a, payNote.trim() || undefined, iso);
    setPayId(null);
  }

  return (
    <div className="card">
      <div className="cardTitle">Innkjøp</div>
      <div className="cardSub">
        Her registrerer du penger brukt + (valgfritt) utestående å betale hvis du ikke betaler med en gang.
      </div>

      <div className="metricGrid">
        <div className="metricCard">
          <div className="metricTitle">Penger brukt (30 dager)</div>
          <div className="metricValue">{fmtKr(spent30)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Penger brukt (totalt)</div>
          <div className="metricValue">{fmtKr(spentTotal)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Utestående å betale</div>
          <div className="metricValue">{fmtKr(unpaidPayables)}</div>
        </div>
      </div>

      <div className="btnRow" style={{ justifyContent: "space-between" }}>
        <button className="btn btnPrimary" type="button" onClick={openNew}>
          + Registrer innkjøp
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Siste innkjøp</div>
        <div className="cardSub">
          Viser <b>{Math.min(showCount, purchases.length)}</b> av <b>{purchases.length}</b>
        </div>

        <div className="list">
          {visible.map((p) => {
            const preview = p.lines.slice(0, 3).map((l) => `• ${l.qty}× ${l.itemName} (${fmtKr(round2(l.qty * l.unitCost))})`);
            const unpaid = p.payableId ? payables.find((x) => x.id === p.payableId) : null;
            const remain = unpaid ? Math.max(0, payableRemaining(unpaid)) : 0;

            return (
              <div key={p.id} className="item">
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{p.supplierName ? p.supplierName : "Innkjøp"}</p>
                    <div className="itemMeta">
                      Total: <b>{fmtKr(p.total)}</b>
                      {" • "}
                      {new Date(p.createdAt).toLocaleString("nb-NO")}
                      {" • "}
                      {p.paid ? <span className="badge success">Betalt</span> : <span className="badge danger">Ikke betalt</span>}
                      {!p.paid && remain > 0 ? (
                        <>
                          {" "}
                          <span className="badge warn">Gjenstår: {fmtKr(remain)}</span>
                        </>
                      ) : null}
                    </div>

                    {preview.length ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Varer:</b>
                        <div style={{ marginTop: 4 }}>
                          {preview.map((t, i) => (
                            <div key={i}>{t}</div>
                          ))}
                          {p.lines.length > 3 ? <div style={{ opacity: 0.9 }}>… +{p.lines.length - 3} til</div> : null}
                        </div>
                      </div>
                    ) : null}

                    {p.note ? (
                      <div className="itemMeta" style={{ marginTop: 6 }}>
                        Notat: <b>{p.note}</b>
                      </div>
                    ) : null}
                  </div>
                </div>

                {!p.paid && p.payableId ? (
                  <div className="itemActions">
                    <button className="btn btnPrimary" type="button" onClick={() => openPay(p.payableId!)}>
                      Registrer betaling
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {purchases.length === 0 ? <div className="item">Ingen innkjøp enda.</div> : null}
        </div>

        {purchases.length > showCount ? (
          <div className="btnRow" style={{ justifyContent: "center" }}>
            <button className="btn" type="button" onClick={() => setShowCount((n) => Math.min(purchases.length, n + 10))}>
              Vis 10 til
            </button>
          </div>
        ) : null}
      </div>

      <Modal open={open} title="Registrer innkjøp" onClose={() => setOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div className="row3">
            <div>
              <label className="label">Leverandør</label>
              <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="F.eks. Biltema / Mekonomen" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={paid ? "paid" : "unpaid"} onChange={(e) => setPaid(e.target.value === "paid")}>
                <option value="paid">Betalt</option>
                <option value="unpaid">Ikke betalt (legg som utestående)</option>
              </select>
            </div>
            <div>
              <label className="label">Forfall (valgfritt)</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="row3">
            <div>
              <label className="label">Oppdater vare-kost</label>
              <select className="input" value={costMode} onChange={(e) => setCostMode(e.target.value as any)}>
                <option value="weighted">Vektet snitt (anbefalt)</option>
                <option value="set_latest">Sett til siste pris</option>
                <option value="keep">Ikke endre</option>
              </select>
            </div>
            <div style={{ gridColumn: "span 2" } as any}>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
          </div>

          <div className="card" style={{ marginTop: 10 }}>
            <div className="cardTitle">Varelinjer</div>
            <div className="cardSub">Legg til flere varer i samme innkjøp.</div>

            <div className="list">
              {lines.map((l, idx) => (
                <div key={l.id} className="item">
                  <div className="itemMeta" style={{ marginBottom: 10 }}>
                    <b>Linje {idx + 1}</b>
                  </div>

                  <div className="row3">
                    <div>
                      <label className="label">Vare</label>
                      <select className="input" value={l.itemId} onChange={(e) => updateLine(l.id, { itemId: e.target.value })}>
                        <option value="">Velg vare…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} (lager: {it.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Antall</label>
                      <input className="input" inputMode="numeric" value={l.qty} onChange={(e) => updateLine(l.id, { qty: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Kost pr stk</label>
                      <input className="input" inputMode="decimal" value={l.unitCost} onChange={(e) => updateLine(l.id, { unitCost: e.target.value })} />
                    </div>
                  </div>

                  <div className="btnRow" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                    <button className="btn" type="button" onClick={() => removeLine(l.id)} disabled={lines.length <= 1}>
                      Fjern linje
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="btnRow">
              <button className="btn" type="button" onClick={addLine}>
                + Legg til linje
              </button>
            </div>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Total innkjøp: <b>{fmtKr(draftTotal)}</b>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setOpen(false)}>
              Avbryt
            </button>
            <button className="btn btnPrimary" type="button" onClick={save}>
              Lagre innkjøp
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!payId} title="Registrer betaling" onClose={() => setPayId(null)}>
        {payId ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
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
              <button className="btn" type="button" onClick={() => setPayId(null)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={savePay}>
                Lagre betaling
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
