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

function parseDateOnly(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysUntil(dueDate?: string) {
  const d = parseDateOnly(dueDate);
  if (!d) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dueLabel(dueDate?: string) {
  const n = daysUntil(dueDate);
  if (n === null) return null;
  if (n < 0) return { kind: "overdue" as const, text: `Forfalt (${Math.abs(n)}d)` };
  if (n === 0) return { kind: "soon" as const, text: "Forfaller i dag" };
  if (n <= 7) return { kind: "soon" as const, text: `Forfaller om ${n}d` };
  return { kind: "ok" as const, text: `Forfaller om ${n}d` };
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

type LineKind = "item" | "consumable" | "equipment";

type DraftLine = {
  id: string;
  kind: LineKind;
  itemId: string;     // brukes kun hvis kind=item
  name: string;       // brukes kun hvis kind!=item
  qty: string;
  unitCost: string;
};

function displayKind(k: LineKind) {
  if (k === "item") return "Vare til lager";
  if (k === "consumable") return "Forbruksmateriell";
  return "Utstyr / investering";
}

function sumDraft(lines: DraftLine[], items: ReturnType<typeof getItems>) {
  return round2(
    lines.reduce((a, l) => {
      const q = Math.max(0, toInt(l.qty));
      const c = round2(toNum(l.unitCost));
      if (q <= 0 || c <= 0) return a;

      // item: ok uansett om item finnes – vi bruker bare kostfeltet her
      // (lageroppdatering skjer i storage.addPurchase)
      return a + round2(q * c);
    }, 0)
  );
}

export function Innkjop() {
  const items = useMemo(() => getItems(), []);
  const { purchases } = usePurchases();
  const { payables, addPayment } = usePayables();

  // NEW purchase modal
  const [open, setOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [paid, setPaid] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const [costMode, setCostMode] = useState<"weighted" | "set_latest" | "keep">("weighted");
  const [lines, setLines] = useState<DraftLine[]>([
    { id: uid("dl"), kind: "item", itemId: "", name: "", qty: "1", unitCost: "" },
  ]);

  const [showCount, setShowCount] = useState(5);

  // Pay payable modal
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

  const unpaidPayables = useMemo(
    () => round2(payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0)),
    [payables]
  );

  const dueSoon = useMemo(() => {
    const list = payables
      .map((p) => ({ p, remain: Math.max(0, payableRemaining(p)), label: dueLabel(p.dueDate) }))
      .filter((x) => x.remain > 0)
      .sort((a, b) => {
        const ad = parseDateOnly(a.p.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const bd = parseDateOnly(b.p.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });

    const overdue = list.filter((x) => x.label?.kind === "overdue");
    const soon = list.filter((x) => x.label?.kind === "soon");

    return {
      overdue: overdue.slice(0, 5),
      soon: soon.slice(0, 5),
      allUnpaid: list.slice(0, 12),
    };
  }, [payables]);

  const draftTotal = useMemo(() => sumDraft(lines, items), [lines, items]);
  const visiblePurchases = useMemo(() => purchases.slice(0, showCount), [purchases, showCount]);

  function addLine() {
    setLines((prev) => [...prev, { id: uid("dl"), kind: "item", itemId: "", name: "", qty: "1", unitCost: "" }]);
  }
  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }
  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };

        // Når man bytter type, resetter vi feltene riktig
        if (patch.kind && patch.kind !== l.kind) {
          if (patch.kind === "item") {
            next.itemId = "";
            next.name = "";
          } else {
            next.itemId = "";
            next.name = "";
          }
        }

        // Hvis vare velges: autopopuler kost (hvis tom)
        if (patch.itemId) {
          const it = items.find((x) => x.id === patch.itemId);
          if (it && String(next.unitCost).trim() === "") next.unitCost = String(it.cost ?? 0);
        }

        return next;
      })
    );
  }

  function openNew() {
    setSupplierName("");
    setPaid(true);
    setDueDate("");
    setNote("");
    setCostMode("weighted");
    setLines([{ id: uid("dl"), kind: "item", itemId: "", name: "", qty: "1", unitCost: "" }]);
    setOpen(true);
  }

  function save() {
    const clean: PurchaseLine[] = [];

    for (const dl of lines) {
      const q = Math.max(0, toInt(dl.qty));
      const c = round2(toNum(dl.unitCost));
      if (q <= 0 || c <= 0) continue;

      if (dl.kind === "item") {
        const it = getItems().find((x) => x.id === dl.itemId);
        if (!it) continue;
        clean.push({
          id: uid("pl"),
          kind: "item",
          itemId: it.id,
          name: it.name,
          qty: q,
          unitCost: c,
        });
      } else {
        const nm = dl.name.trim();
        if (!nm) continue;
        clean.push({
          id: uid("pl"),
          kind: dl.kind,
          itemId: undefined,
          name: nm,
          qty: q,
          unitCost: c,
        });
      }
    }

    if (clean.length === 0) return alert("Legg til minst én linje med antall + kost.");

    addPurchase({
      supplierName: supplierName.trim() ? supplierName.trim() : undefined,
      lines: clean.map((l) => ({
        kind: l.kind,
        itemId: l.itemId || "",
        itemName: l.name,
        qty: l.qty,
        unitCost: l.unitCost,
      })),
      paid,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      costMode,
      payableTitle: "Innkjøp",
    });

    setOpen(false);
  }

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
        Registrer vare-innkjøp (oppdater lager) + forbruksmateriell + utstyr. Kan også være “ikke betalt” (leverandørgjeld).
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

      <div className="card">
        <div className="cardTitle">Varsler</div>
        <div className="cardSub">Forfalt og forfaller snart (leverandørgjeld).</div>

        <div className="list">
          {dueSoon.overdue.length === 0 && dueSoon.soon.length === 0 ? (
            <div className="item">
              <div className="itemMeta">Ingen forfalte / kommende betalinger 🎉</div>
            </div>
          ) : null}

          {dueSoon.overdue.map(({ p, remain, label }) => (
            <div key={p.id} className="item low">
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{p.supplierName}</p>
                  <div className="itemMeta">
                    <span className="badge danger">{label?.text ?? "Forfalt"}</span>{" "}
                    <span className="badge warn">Gjenstår: {fmtKr(remain)}</span>
                  </div>
                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    {p.title ? <b>{p.title}</b> : null} {p.dueDate ? <>• Forfall: <b>{p.dueDate}</b></> : null}
                  </div>
                </div>
              </div>
              <div className="itemActions">
                <button className="btn btnPrimary" type="button" onClick={() => openPay(p.id)}>
                  Registrer betaling
                </button>
              </div>
            </div>
          ))}

          {dueSoon.soon.map(({ p, remain, label }) => (
            <div key={p.id} className="item">
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{p.supplierName}</p>
                  <div className="itemMeta">
                    <span className="badge warn">{label?.text ?? "Forfaller snart"}</span>{" "}
                    <span className="badge warn">Gjenstår: {fmtKr(remain)}</span>
                  </div>
                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    {p.title ? <b>{p.title}</b> : null} {p.dueDate ? <>• Forfall: <b>{p.dueDate}</b></> : null}
                  </div>
                </div>
              </div>
              <div className="itemActions">
                <button className="btn btnPrimary" type="button" onClick={() => openPay(p.id)}>
                  Registrer betaling
                </button>
              </div>
            </div>
          ))}
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
          {visiblePurchases.map((p) => {
            const preview = p.lines
              .slice(0, 3)
              .map((l) => `• ${l.qty}× ${l.name} (${fmtKr(round2(l.qty * l.unitCost))})`);
            const due = dueLabel(p.dueDate);

            return (
              <div key={p.id} className="item">
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{p.supplierName ? p.supplierName : "Innkjøp"}</p>
                    <div className="itemMeta">
                      Total: <b>{fmtKr(p.total)}</b> • {new Date(p.createdAt).toLocaleString("nb-NO")} •{" "}
                      {p.paid ? <span className="badge success">Betalt</span> : <span className="badge danger">Ikke betalt</span>}
                      {!p.paid && due ? (
                        <>
                          {" "}
                          {due.kind === "overdue" ? (
                            <span className="badge danger">{due.text}</span>
                          ) : due.kind === "soon" ? (
                            <span className="badge warn">{due.text}</span>
                          ) : (
                            <span className="badge">{due.text}</span>
                          )}
                        </>
                      ) : null}
                    </div>

                    {preview.length ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Linjer:</b>
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
            <div className="cardTitle">Linjer</div>
            <div className="cardSub">Bland varer, forbruksmateriell og utstyr i samme innkjøp.</div>

            <div className="list">
              {lines.map((l, idx) => (
                <div key={l.id} className="item">
                  <div className="itemMeta" style={{ marginBottom: 10 }}>
                    <b>Linje {idx + 1}</b>
                  </div>

                  <div className="row3">
                    <div>
                      <label className="label">Type</label>
                      <select className="input" value={l.kind} onChange={(e) => updateLine(l.id, { kind: e.target.value as LineKind })}>
                        <option value="item">{displayKind("item")}</option>
                        <option value="consumable">{displayKind("consumable")}</option>
                        <option value="equipment">{displayKind("equipment")}</option>
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

                  {l.kind === "item" ? (
                    <div style={{ marginTop: 10 }}>
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
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <label className="label">{l.kind === "consumable" ? "Forbruk (navn)" : "Utstyr (navn)"}</label>
                      <input className="input" value={l.name} onChange={(e) => updateLine(l.id, { name: e.target.value })} placeholder="F.eks. Hansker / WD-40 / Kompressor" />
                    </div>
                  )}

                  <div className="itemMeta" style={{ marginTop: 10 }}>
                    Linjesum: <b>{fmtKr(round2(Math.max(0, toInt(l.qty)) * Math.max(0, round2(toNum(l.unitCost)))))}</b>
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
