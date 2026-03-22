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
  setSalePaid,
  uid,
  useCustomers,
  useItems,
  useSales,
  Sale,
  SaleLine,
} from "../app/storage";

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function toInt(v: string) {
  const n = Math.trunc(toNum(v));
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
  qty: string;
  unitPrice: string;
};

function sumDraft(lines: DraftLine[]) {
  return round2(
    lines.reduce((a, l) => {
      const q = Math.trunc(toNum(l.qty));
      const p = toNum(l.unitPrice);
      return a + round2(q * p);
    }, 0)
  );
}

function saleLinesSafe(s: Sale): SaleLine[] {
  const lines = Array.isArray((s as any).lines) ? ((s as any).lines as SaleLine[]) : [];
  if (lines.length > 0) return lines;

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

function fmtLineShort(l: SaleLine) {
  return `${l.qty}× ${l.itemName}`;
}

function fmtLineWithSum(l: SaleLine) {
  const lineSum = round2((l.qty || 0) * (l.unitPrice || 0));
  return `${l.qty}× ${l.itemName} (${fmtKr(lineSum)})`;
}

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale } = useSales();

  // filters / paging
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);

  // new sale modal
  const [newOpen, setNewOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [paidFlag, setPaidFlag] = useState<boolean>(true);
  const [dueDate, setDueDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => [
    { id: uid("dl"), itemId: "", qty: "1", unitPrice: "" },
  ]);

  // payment modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  // delete choice modal
  const [delSale, setDelSale] = useState<Sale | null>(null);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  // preselect customer from Kunder
  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  // if filter changes, reset paging
  useEffect(() => {
    setVisibleCount(5);
    setOpenId(null);
  }, [onlyUnpaid]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  const filteredSales = useMemo(() => {
    const base = onlyUnpaid ? sales.filter((s) => Math.max(0, saleRemaining(s)) > 0) : sales;
    return base;
  }, [sales, onlyUnpaid]);

  const visibleSales = useMemo(() => filteredSales.slice(0, visibleCount), [filteredSales, visibleCount]);

  const draftTotal = useMemo(() => sumDraft(draftLines), [draftLines]);

  function openNewSale() {
    setPaidFlag(true);
    setDueDate("");
    setNote("");
    setDraftLines([{ id: uid("dl"), itemId: "", qty: "1", unitPrice: "" }]);
    setNewOpen(true);
  }

  function closeNewSale() {
    setNewOpen(false);
  }

  function addDraftLine() {
    setDraftLines((prev) => [...prev, { id: uid("dl"), itemId: "", qty: "1", unitPrice: "" }]);
  }

  function removeDraftLine(id: string) {
    setDraftLines((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setDraftLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };

        // autopopulate price when selecting item (only if empty)
        if (patch.itemId) {
          const it = items.find((x) => x.id === patch.itemId);
          if (it && String(next.unitPrice).trim() === "") next.unitPrice = String(it.price ?? 0);
        }
        return next;
      })
    );
  }

  function saveNewSale() {
    const clean: SaleLine[] = [];

    for (const dl of draftLines) {
      const it = items.find((x) => x.id === dl.itemId);
      if (!it) continue;

      const q = toInt(dl.qty);
      if (q <= 0) continue;

      const p = round2(toNum(dl.unitPrice || String(it.price ?? 0)));
      clean.push({
        id: uid("line"),
        itemId: it.id,
        itemName: it.name,
        qty: q,
        unitPrice: p,
        unitCostAtSale: round2(Number(it.cost ?? 0)),
      });
    }

    if (clean.length === 0) return alert("Legg til minst én varelinje med vare + antall.");

    // reduce stock
    const itemsNow = getItems();
    for (const line of clean) {
      const idx = itemsNow.findIndex((x) => x.id === line.itemId);
      if (idx < 0) return alert("Fant ikke en vare i lageret (prøv å oppdatere siden).");
      const newStock = (itemsNow[idx].stock ?? 0) - line.qty;
      itemsNow[idx] = { ...itemsNow[idx], stock: newStock, updatedAt: new Date().toISOString() };
    }
    setItems(itemsNow);

    addSale({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      lines: clean,
      paid: paidFlag,
      dueDate: dueDate.trim() ? dueDate.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
    });

    // low stock alert
    const low: string[] = [];
    for (const line of clean) {
      const it = itemsNow.find((x) => x.id === line.itemId);
      if (!it) continue;
      const min = it.minStock ?? 0;
      if (min > 0 && (it.stock ?? 0) <= min) low.push(`${it.name} (lager: ${it.stock}, min: ${min})`);
    }
    if (low.length) alert(`⚠️ Lav lagerbeholdning:\n\n${low.join("\n")}`);

    setNewOpen(false);
  }

  function toggleOpen(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
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
    setOpenId(null);
  }

  function togglePaid(s: Sale) {
    const next = !Boolean(s.paid);
    setSalePaid(s.id, next);
  }

  function showMore() {
    setVisibleCount((n) => Math.min(filteredSales.length, n + 10));
  }

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        Utestående totalt: <b className="dangerText">{fmtKr(outstandingTotal)}</b>
      </div>

      <div className="btnRow" style={{ justifyContent: "space-between" }}>
        <button className="btn btnPrimary" type="button" onClick={openNewSale}>
          + Nytt salg
        </button>

        <button className="btn" type="button" onClick={() => setOnlyUnpaid((v) => !v)}>
          {onlyUnpaid ? "Vis alle" : "Vis kun utestående"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardTitle">Liste</div>
        <div className="cardSub">
          Viser <b>{Math.min(visibleCount, filteredSales.length)}</b> av <b>{filteredSales.length}</b>
        </div>

        <div className="list">
          {visibleSales.map((s) => {
            const rem = Math.max(0, saleRemaining(s));
            const paidOk = rem <= 0 || s.paid;

            const lines = saleLinesSafe(s);
            const shortLines = lines.slice(0, 2).map(fmtLineShort).join(", ");
            const more = lines.length > 2 ? ` +${lines.length - 2}` : "";
            const bought = (shortLines ? `${shortLines}${more}` : "Salg");

            const isOpen = openId === s.id;

            return (
              <div key={s.id} className="item">
                {/* Compact row */}
                <div
                  className="rowItem"
                  onClick={() => toggleOpen(s.id)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <p className="rowItemTitle">{s.customerName ? s.customerName : "Anonym"}</p>
                    <div className="rowItemSub">
                      <b>{fmtKr(s.total)}</b>{" "}
                      • <span className={paidOk ? "successText" : "dangerText"}>{paidOk ? "Betalt" : "Ubetalt"}</span>{" "}
                      • {bought}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {paidOk ? <span className="badge success">Betalt</span> : <span className="badge danger">Ubetalt</span>}
                    <span className="badge">{isOpen ? "−" : "+"}</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="itemMeta">
                      Dato: <b>{new Date(s.createdAt).toLocaleString("nb-NO")}</b>
                      {s.dueDate ? (
                        <>
                          {" "}
                          • Forfall: <b>{s.dueDate}</b>
                        </>
                      ) : null}
                    </div>

                    {lines.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Varer:</b>
                        <div style={{ marginTop: 6 }}>
                          {lines.slice(0, 8).map((l) => (
                            <div key={l.id}>• {fmtLineWithSum(l)}</div>
                          ))}
                          {lines.length > 8 ? <div style={{ opacity: 0.85, marginTop: 4 }}>… +{lines.length - 8} til</div> : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="itemMeta" style={{ marginTop: 10 }}>
                      Innbetalt:{" "}
                      <b className={paidOk ? "successText" : ""}>{fmtKr(salePaidSum(s))}</b>{" "}
                      • Utestående:{" "}
                      <b className={rem > 0 ? "dangerText" : "successText"}>{fmtKr(rem)}</b>
                    </div>

                    {s.note ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        Notat: <b>{s.note}</b>
                      </div>
                    ) : null}

                    {Array.isArray(s.payments) && s.payments.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 10 }}>
                        <b>Innbetalinger:</b>
                        <div style={{ marginTop: 6 }}>
                          {s.payments
                            .slice()
                            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                            .slice(0, 6)
                            .map((p) => (
                              <div key={p.id}>
                                • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                                {p.note ? <> ({p.note})</> : null}
                              </div>
                            ))}
                          {s.payments.length > 6 ? <div style={{ opacity: 0.85, marginTop: 4 }}>… +{s.payments.length - 6} til</div> : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="btnRow" style={{ marginTop: 12 }}>
                      {rem > 0 ? (
                        <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                          Registrer innbetaling
                        </button>
                      ) : (
                        <button className="btn" type="button" disabled>
                          Betalt
                        </button>
                      )}

                      <button className="btn" type="button" onClick={() => togglePaid(s)}>
                        {s.paid ? "Marker ubetalt" : "Marker betalt"}
                      </button>

                      <button className="btn btnDanger" type="button" onClick={() => askDelete(s)}>
                        Slett
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredSales.length === 0 ? <div className="item">Ingen salg.</div> : null}
        </div>

        {filteredSales.length > visibleCount ? (
          <div className="btnRow" style={{ marginTop: 12, justifyContent: "center" }}>
            <button className="btn" type="button" onClick={showMore}>
              Vis 10 til
            </button>
          </div>
        ) : null}
      </div>

      {/* NEW SALE MODAL */}
      <Modal open={newOpen} title="Nytt salg" onClose={closeNewSale}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
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
              <label className="label">Status</label>
              <select className="input" value={paidFlag ? "paid" : "unpaid"} onChange={(e) => setPaidFlag(e.target.value === "paid")}>
                <option value="paid">Betalt</option>
                <option value="unpaid">Ubetalt</option>
              </select>
            </div>

            <div>
              <label className="label">Forfall</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div>
              <label className="label">Notat</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt" />
            </div>
          </div>

          <div className="card" style={{ marginTop: 10 }}>
            <div className="cardTitle">Varelinjer</div>
            <div className="cardSub">Legg til én eller flere varer før du lagrer.</div>

            <div className="list" style={{ marginTop: 0 }}>
              {draftLines.map((dl, idx) => {
                const it = items.find((x) => x.id === dl.itemId) ?? null;
                const lineSum = round2(toInt(dl.qty) * toNum(dl.unitPrice || (it ? String(it.price ?? 0) : "0")));

                return (
                  <div key={dl.id} className="item">
                    <div className="itemTop">
                      <div>
                        <p className="itemTitle" style={{ fontSize: 16, marginBottom: 2 }}>Linje {idx + 1}</p>
                        <div className="itemMeta">{it ? it.name : "Velg vare"}</div>
                      </div>

                      <button className="btn" type="button" onClick={() => removeDraftLine(dl.id)} disabled={draftLines.length <= 1}>
                        Fjern
                      </button>
                    </div>

                    <div className="row3" style={{ marginTop: 10 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="label">Vare</label>
                        <select className="input" value={dl.itemId} onChange={(e) => updateLine(dl.id, { itemId: e.target.value })}>
                          <option value="">Velg vare…</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (lager: {i.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label">Antall</label>
                        <input className="input" inputMode="numeric" value={dl.qty} onChange={(e) => updateLine(dl.id, { qty: e.target.value })} />
                      </div>

                      <div>
                        <label className="label">Pris</label>
                        <input
                          className="input"
                          inputMode="decimal"
                          value={dl.unitPrice}
                          onChange={(e) => updateLine(dl.id, { unitPrice: e.target.value })}
                          placeholder={it ? String(it.price ?? 0) : "0"}
                        />
                      </div>

                      <div>
                        <label className="label">Linjesum</label>
                        <input className="input" value={fmtKr(lineSum)} readOnly />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="btnRow" style={{ marginTop: 10 }}>
              <button className="btn" type="button" onClick={addDraftLine}>
                + Legg til varelinje
              </button>
            </div>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Total: <b>{fmtKr(draftTotal)}</b>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={closeNewSale}>
              Avbryt
            </button>
            <button className="btn btnPrimary" type="button" onClick={saveNewSale}>
              Lagre salg
            </button>
          </div>
        </div>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal open={!!paySale} title="Registrer innbetaling" onClose={() => setPaySale(null)}>
        {paySale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>{paySale.customerName ? paySale.customerName : "Anonym"}</b> • Utestående nå:{" "}
              <b className="dangerText">{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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

            <div className="btnRow">
              <button className="btn btnPrimary" type="button" onClick={savePayment}>
                Lagre
              </button>
              <button className="btn" type="button" onClick={() => setPaySale(null)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* DELETE CHOICE MODAL */}
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
            <b>{delSale.customerName ? delSale.customerName : "Anonym"}</b>
            <br />
            Total: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varene skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
