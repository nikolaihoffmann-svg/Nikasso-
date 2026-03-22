// src/pages/Salg.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addSale,
  addSalePayment,
  clearSaleDraftCustomer,
  fmtKr,
  getItems,
  getSaleDraftCustomer,
  round2,
  salePaidSum,
  saleRemaining,
  setItems,
  uid,
  useCustomers,
  useItems,
  useSales,
  Vare,
  Sale,
  SaleLine,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lineTotal(qty: number, unitPrice: number) {
  return round2((Number(qty) || 0) * (Number(unitPrice) || 0));
}

function saleLinesSafe(s: Sale): SaleLine[] {
  const lines = Array.isArray((s as any).lines) ? ((s as any).lines as SaleLine[]) : [];
  if (lines.length > 0) return lines;

  // fallback for eldre salg (1 vare pr salg)
  const itemName = (s as any).itemName;
  const itemId = (s as any).itemId;
  const qty = (s as any).qty;
  const unitPrice = (s as any).unitPrice;
  if (itemName && itemId && Number(qty)) {
    return [
      {
        id: "legacy",
        itemId: String(itemId),
        itemName: String(itemName),
        qty: Number(qty) || 0,
        unitPrice: Number(unitPrice) || 0,
        unitCostAtSale: (s as any).unitCostAtSale,
      } as any,
    ];
  }
  return [];
}

function calcSaleTotal(lines: SaleLine[]) {
  return round2(lines.reduce((a, l) => a + lineTotal(Number(l.qty) || 0, Number(l.unitPrice) || 0), 0));
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

        <div className="modalBody">
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

type DraftLine = {
  id: string;
  itemId: string;
  qty: string; // text input
  unitPrice: string; // text input
};

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale, setAll } = useSales();

  // ✅ Vis 5 default, vis mer +10
  const [showCount, setShowCount] = useState<number>(5);

  // ✅ Vis kun utestående
  const [onlyOutstanding, setOnlyOutstanding] = useState<boolean>(false);

  // form
  const [customerId, setCustomerId] = useState<string>("");
  const [paid, setPaid] = useState<boolean>(true); // ✅ default betalt
  const [note, setNote] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  // flere linjer
  const [lines, setLines] = useState<DraftLine[]>(() => [
    { id: uid("dline"), itemId: "", qty: "1", unitPrice: "" },
  ]);

  // low stock popup
  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  // betaling modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  // slett modal (2 valg)
  const [delSale, setDelSale] = useState<Sale | null>(null);

  // rediger salg modal
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>("");
  const [editPaid, setEditPaid] = useState<boolean>(false);
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editLines, setEditLines] = useState<DraftLine[]>([]);

  // forhåndsvalg kunde fra Kunder-siden
  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  // map items
  const itemsById = useMemo(() => {
    const m = new Map<string, Vare>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  function ensureLinePriceIfEmpty(line: DraftLine, itemId: string) {
    const it = itemsById.get(itemId);
    if (!it) return line;
    if (String(line.unitPrice ?? "").trim() !== "") return line;
    return { ...line, unitPrice: String(it.price ?? 0) };
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if (patch.itemId) return ensureLinePriceIfEmpty(next, patch.itemId);
        return next;
      })
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { id: uid("dline"), itemId: "", qty: "1", unitPrice: "" }]);
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  const saleLinesForSave = useMemo(() => {
    const out: SaleLine[] = [];
    for (const dl of lines) {
      const it = itemsById.get(dl.itemId);
      if (!it) continue;
      const q = Math.trunc(toNum(dl.qty));
      if (q === 0) continue;
      const p = round2(toNum(dl.unitPrice || String(it.price ?? 0)));
      out.push({
        id: uid("line"),
        itemId: it.id,
        itemName: it.name,
        qty: q,
        unitPrice: p,
        unitCostAtSale: Number.isFinite(Number(it.cost)) ? Number(it.cost) : undefined,
      } as any);
    }
    return out;
  }, [lines, itemsById]);

  const formTotal = useMemo(() => calcSaleTotal(saleLinesForSave), [saleLinesForSave]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  const filteredSales = useMemo(() => {
    if (!onlyOutstanding) return sales;
    return sales.filter((s) => saleRemaining(s) > 0);
  }, [sales, onlyOutstanding]);

  const visibleSales = useMemo(() => filteredSales.slice(0, showCount), [filteredSales, showCount]);
  const canShowMore = filteredSales.length > showCount;

  // mest solgt (totalt)
  const topSold = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; qty: number; revenue: number }>();
    for (const s of sales) {
      const sl = saleLinesSafe(s);
      for (const l of sl) {
        const key = l.itemId || l.itemName;
        const prev = map.get(key) || { itemId: String(l.itemId), name: String(l.itemName), qty: 0, revenue: 0 };
        const qty = Number(l.qty) || 0;
        const rev = lineTotal(qty, Number(l.unitPrice) || 0);
        prev.qty += qty;
        prev.revenue += rev;
        map.set(key, prev);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    return arr.slice(0, 10);
  }, [sales]);

  function resetForm() {
    setCustomerId("");
    setPaid(true);
    setNote("");
    setDueDate("");
    setLines([{ id: uid("dline"), itemId: "", qty: "1", unitPrice: "" }]);
  }

  function doSale() {
    if (saleLinesForSave.length === 0) return alert("Legg til minst én varelinje.");

    // trekk lager for alle linjer
    const itemsNow = getItems();
    const itemsIdx = new Map<string, number>();
    itemsNow.forEach((it, idx) => itemsIdx.set(it.id, idx));

    const lowHits: { item: Vare; newStock: number }[] = [];

    for (const l of saleLinesForSave) {
      const idx = itemsIdx.get(l.itemId);
      if (idx == null) continue;
      const newStock = (itemsNow[idx].stock ?? 0) - (l.qty ?? 0);
      itemsNow[idx] = { ...itemsNow[idx], stock: newStock, updatedAt: new Date().toISOString() };

      const min = itemsNow[idx].minStock ?? 0;
      if (min > 0 && newStock <= min) lowHits.push({ item: itemsNow[idx], newStock });
    }

    setItems(itemsNow);

    // betal status
    const payments = paid
      ? [{ id: uid("pay"), amount: formTotal, createdAt: new Date().toISOString() }]
      : [];

    addSale({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      lines: saleLinesForSave,
      paid,
      payments,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
    } as any);

    // popup hvis vi traff min-lager på minst en vare
    if (lowHits.length > 0) setLowPopup(lowHits[0]);

    resetForm();
  }

  function openPayment(s: Sale) {
    setPaySale(s);
    setPayAmount(String(Math.max(0, saleRemaining(s)) || 0));
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  function savePayment() {
    if (!paySale) return;
    const a = toNum(payAmount);
    if (a <= 0) return alert("Innbetaling må være over 0.");
    const iso = payDate ? new Date(`${payDate}T12:00:00`).toISOString() : undefined;
    addSalePayment(paySale.id, a, payNote.trim() || undefined, iso);
    setPaySale(null);
  }

  function askDelete(s: Sale) {
    setDelSale(s);
  }

  function doDelete(restoreStock: boolean) {
    if (!delSale) return;
    removeSale(delSale.id, restoreStock);
    setDelSale(null);
  }

  function openEdit(s: Sale) {
    setEditSale(s);
    setEditCustomerId(s.customerId ?? "");
    setEditPaid(saleRemaining(s) <= 0); // “betalt” hvis ingenting utestående
    setEditDueDate((s as any).dueDate ?? "");
    setEditNote((s as any).note ?? "");

    const sl = saleLinesSafe(s);
    setEditLines(
      sl.length > 0
        ? sl.map((l) => ({
            id: l.id || uid("dline"),
            itemId: l.itemId,
            qty: String(l.qty ?? 0),
            unitPrice: String(l.unitPrice ?? 0),
          }))
        : [{ id: uid("dline"), itemId: "", qty: "1", unitPrice: "" }]
    );
  }

  function updateEditLine(id: string, patch: Partial<DraftLine>) {
    setEditLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if (patch.itemId) {
          const it = itemsById.get(patch.itemId);
          if (it && String(next.unitPrice).trim() === "") return { ...next, unitPrice: String(it.price ?? 0) };
        }
        return next;
      })
    );
  }

  function addEditLine() {
    setEditLines((prev) => [...prev, { id: uid("dline"), itemId: "", qty: "1", unitPrice: "" }]);
  }

  function removeEditLine(id: string) {
    setEditLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function saveEdit() {
    if (!editSale) return;

    const nextCustomer = customers.find((c) => c.id === editCustomerId) ?? null;

    const outLines: SaleLine[] = [];
    for (const dl of editLines) {
      const it = itemsById.get(dl.itemId);
      if (!it) continue;
      const q = Math.trunc(toNum(dl.qty));
      if (q === 0) continue;
      const p = round2(toNum(dl.unitPrice || String(it.price ?? 0)));
      outLines.push({
        id: dl.id || uid("line"),
        itemId: it.id,
        itemName: it.name,
        qty: q,
        unitPrice: p,
        unitCostAtSale: Number.isFinite(Number(it.cost)) ? Number(it.cost) : undefined,
      } as any);
    }

    if (outLines.length === 0) return alert("Minst én varelinje må være med.");

    const total = calcSaleTotal(outLines);

    // ⚠️ Vi endrer ikke lager her (for å unngå dobbel justering).
    // Betalt/ubetalt: hvis “betalt” -> sett payments = [full betaling] (beholder evt historikk? her gjør vi enkelt)
    const payments = editPaid ? [{ id: uid("pay"), amount: total, createdAt: new Date().toISOString() }] : [];

    const nextSale: Sale = {
      ...editSale,
      customerId: nextCustomer?.id,
      customerName: nextCustomer?.name,
      lines: outLines as any,
      total,
      paid: editPaid,
      payments: payments as any,
      dueDate: editDueDate.trim() ? editDueDate.trim() : undefined,
      note: editNote.trim() ? editNote.trim() : undefined,
    } as any;

    const nextAll = sales.map((s) => (s.id === editSale.id ? nextSale : s));
    setAll(nextAll);

    setEditSale(null);
  }

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        <b>Utestående salg totalt:</b> <b>{fmtKr(outstandingTotal)}</b>
      </div>

      {/* Mest solgt */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Mest solgt</div>
        <div className="cardSub">Topp 10 basert på antall solgte enheter.</div>
        <div className="list">
          {topSold.length === 0 ? (
            <div className="item">Ingen salg enda.</div>
          ) : (
            topSold.map((x) => (
              <div key={x.itemId || x.name} className="item">
                <p className="itemTitle">{x.name}</p>
                <div className="itemMeta">
                  Antall: <b>{x.qty}</b> • Omsetning: <b>{fmtKr(x.revenue)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Nytt salg (flere linjer) */}
      <div className="card">
        <div className="cardTitle">Nytt salg</div>
        <div className="cardSub">Legg til flere varer før du lagrer.</div>

        <div className="fieldGrid">
          <div>
            <label className="label">Kunde (valgfritt)</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Ingen / anonymt salg…</option>
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

          <div className="row3">
            <div>
              <label className="label">Betalt?</label>
              <select className="input" value={paid ? "yes" : "no"} onChange={(e) => setPaid(e.target.value === "yes")}>
                <option value="yes">Betalt</option>
                <option value="no">Ubetalt</option>
              </select>
            </div>
            <div>
              <label className="label">Forfall (valgfritt)</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Notat (valgfritt)</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fritekst" />
            </div>
          </div>

          {/* Linjer */}
          <div className="list" style={{ marginTop: 6 }}>
            {lines.map((l, idx) => (
              <div key={l.id} className="item">
                <p className="itemTitle" style={{ fontSize: 16 }}>
                  Varelinje {idx + 1}
                </p>

                <div className="fieldGrid" style={{ marginTop: 10 }}>
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

                  <div className="row3">
                    <div>
                      <label className="label">Antall</label>
                      <input className="input" inputMode="numeric" value={l.qty} onChange={(e) => updateLine(l.id, { qty: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Pris pr stk</label>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.id, { unitPrice: e.target.value })}
                        placeholder={l.itemId ? String(itemsById.get(l.itemId)?.price ?? 0) : "0"}
                      />
                    </div>
                    <div>
                      <label className="label">Linjesum</label>
                      <input
                        className="input"
                        readOnly
                        value={fmtKr(
                          lineTotal(
                            Math.trunc(toNum(l.qty)),
                            toNum(l.unitPrice || String(itemsById.get(l.itemId)?.price ?? 0))
                          )
                        )}
                      />
                    </div>
                  </div>

                  <div className="btnRow">
                    <button className="btn" type="button" onClick={() => removeLine(l.id)} disabled={lines.length <= 1}>
                      Fjern linje
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="btnRow">
            <button className="btn" type="button" onClick={addLine}>
              + Legg til varelinje
            </button>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Total: <b style={{ fontSize: 18 }}>{fmtKr(formTotal)}</b>
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={doSale}>
              Lagre salg
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        <div className="cardTitle">Salg</div>

        <div className="subRow" style={{ marginTop: 6 }}>
          <div className="sub">Viser {Math.min(showCount, filteredSales.length)} av {filteredSales.length}</div>
        </div>

        <div className="btnRow" style={{ marginTop: 10 }}>
          <button className={onlyOutstanding ? "btn btnPrimary" : "btn"} type="button" onClick={() => setOnlyOutstanding((v) => !v)}>
            {onlyOutstanding ? "Viser kun utestående" : "Vis kun utestående"}
          </button>
        </div>

        <div className="list">
          {visibleSales.map((s) => {
            const paidSum = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const sl = saleLinesSafe(s);

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <p className="itemTitle">{s.customerName ? s.customerName : "Anonymt salg"}</p>

                <div className="itemMeta">
                  Sum: <b>{fmtKr(s.total)}</b> • Innbetalt: <b>{fmtKr(paidSum)}</b> • Utestående: <b>{fmtKr(rem)}</b> •{" "}
                  {new Date(s.createdAt).toLocaleString("nb-NO")}
                </div>

                {/* Pent: hva kunden kjøpte */}
                {sl.length > 0 ? (
                  <div className="itemMeta" style={{ marginTop: 10 }}>
                    <b>Kjøpt:</b>
                    {sl.map((l) => (
                      <div key={l.id} style={{ marginTop: 4 }}>
                        • {l.itemName} — <b>{l.qty} stk</b> × <b>{fmtKr(l.unitPrice)}</b> = <b>{fmtKr(lineTotal(l.qty, l.unitPrice))}</b>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Innbetalinger */}
                {Array.isArray((s as any).payments) && (s as any).payments.length > 0 ? (
                  <div className="itemMeta" style={{ marginTop: 10 }}>
                    <b>Innbetalinger:</b>
                    {(s as any).payments.slice(0, 4).map((p: any) => (
                      <div key={p.id} style={{ marginTop: 4 }}>
                        • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                        {p.note ? <> ({p.note})</> : null}
                      </div>
                    ))}
                    {(s as any).payments.length > 4 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{(s as any).payments.length - 4} til</div> : null}
                  </div>
                ) : null}

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : (
                    <button className="btn" type="button" disabled>
                      Betalt
                    </button>
                  )}

                  <button className="btn" type="button" onClick={() => openEdit(s)}>
                    Rediger
                  </button>

                  <button className="btn btnDanger" type="button" onClick={() => askDelete(s)}>
                    Slett
                  </button>
                </div>
              </div>
            );
          })}

          {filteredSales.length === 0 ? <div className="item">Ingen salg å vise.</div> : null}
        </div>

        {canShowMore ? (
          <div className="btnRow" style={{ justifyContent: "center", marginTop: 14 }}>
            <button className="btn" type="button" onClick={() => setShowCount((n) => n + 10)}>
              Vis mer (+10)
            </button>
          </div>
        ) : null}
      </div>

      {/* Popups */}
      <Modal open={!!lowPopup} title="⚠️ Lav lagerbeholdning" onClose={() => setLowPopup(null)}>
        {lowPopup ? (
          <div>
            <div style={{ marginBottom: 10 }}>
              <b>{lowPopup.item.name}</b>
            </div>
            <div>
              Ny beholdning: <b>{lowPopup.newStock}</b> • Minimum: <b>{lowPopup.item.minStock}</b>
            </div>
            <div style={{ marginTop: 10, opacity: 0.9 }}>Tips: Gå til <b>Varer</b> og øk lager, eller juster minimum per vare.</div>
            <div className="btnRow" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" type="button" onClick={() => setLowPopup(null)}>
                Ok
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!paySale} title="Registrer innbetaling på salg" onClose={() => setPaySale(null)}>
        {paySale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>{paySale.customerName || "Anonymt salg"}</b> • Utestående: <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
              <button className="btn" type="button" onClick={() => setPaySale(null)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ChoiceModal
        open={!!delSale}
        title="Slette salg?"
        onClose={() => setDelSale(null)}
        cancelText="Avbryt"
        onCancel={() => setDelSale(null)}
        secondaryText="Slett (ikke tilbake på lager)"
        onSecondary={() => doDelete(false)}
        primaryText="Slett + legg tilbake på lager"
        onPrimary={() => doDelete(true)}
      >
        {delSale ? (
          <div className="itemMeta" style={{ marginTop: 0 }}>
            Kunde: <b>{delSale.customerName || "Anonym"}</b>
            <br />
            Sum: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varene skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>

      <Modal open={!!editSale} title="Rediger salg" onClose={() => setEditSale(null)}>
        {editSale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div>
              <label className="label">Kunde</label>
              <select className="input" value={editCustomerId} onChange={(e) => setEditCustomerId(e.target.value)}>
                <option value="">Ingen / anonymt salg…</option>
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

            <div className="row3">
              <div>
                <label className="label">Betalt?</label>
                <select className="input" value={editPaid ? "yes" : "no"} onChange={(e) => setEditPaid(e.target.value === "yes")}>
                  <option value="yes">Betalt</option>
                  <option value="no">Ubetalt</option>
                </select>
              </div>
              <div>
                <label className="label">Forfall</label>
                <input className="input" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Notat</label>
                <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Valgfritt" />
              </div>
            </div>

            <div className="list" style={{ marginTop: 6 }}>
              {editLines.map((l, idx) => (
                <div key={l.id} className="item">
                  <p className="itemTitle" style={{ fontSize: 16 }}>
                    Linje {idx + 1}
                  </p>

                  <div className="fieldGrid" style={{ marginTop: 10 }}>
                    <div>
                      <label className="label">Vare</label>
                      <select className="input" value={l.itemId} onChange={(e) => updateEditLine(l.id, { itemId: e.target.value })}>
                        <option value="">Velg vare…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="row3">
                      <div>
                        <label className="label">Antall</label>
                        <input className="input" inputMode="numeric" value={l.qty} onChange={(e) => updateEditLine(l.id, { qty: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Pris pr stk</label>
                        <input className="input" inputMode="decimal" value={l.unitPrice} onChange={(e) => updateEditLine(l.id, { unitPrice: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Linjesum</label>
                        <input className="input" readOnly value={fmtKr(lineTotal(Math.trunc(toNum(l.qty)), toNum(l.unitPrice)))} />
                      </div>
                    </div>

                    <div className="btnRow">
                      <button className="btn" type="button" onClick={() => removeEditLine(l.id)} disabled={editLines.length <= 1}>
                        Fjern linje
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="btnRow">
              <button className="btn" type="button" onClick={addEditLine}>
                + Legg til varelinje
              </button>
            </div>

            <div className="itemMeta">
              Ny total: <b>{fmtKr(calcSaleTotal(editLines.map((l) => ({ id: l.id, itemId: l.itemId, itemName: itemsById.get(l.itemId)?.name ?? "", qty: Math.trunc(toNum(l.qty)), unitPrice: toNum(l.unitPrice) } as any)).filter((x) => x.itemId && x.itemName && x.qty !== 0)))}</b>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                NB: Redigering endrer ikke lager automatisk (for å unngå feil). Bruk slett + “legg tilbake på lager” om du må korrigere lager.
              </div>
            </div>

            <div className="btnRow">
              <button className="btn btnPrimary" type="button" onClick={saveEdit}>
                Lagre endringer
              </button>
              <button className="btn" type="button" onClick={() => setEditSale(null)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
