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

function fmtLineCompact(l: SaleLine) {
  const lineSum = round2((l.qty || 0) * (l.unitPrice || 0));
  return `${l.qty}× ${l.itemName} (${fmtKr(lineSum)})`;
}

function isPaid(s: Sale) {
  const rem = Math.max(0, saleRemaining(s));
  return rem <= 0 || Boolean(s.paid);
}

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale } = useSales();

  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  // New sale modal
  const [newOpen, setNewOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [paidFlag, setPaidFlag] = useState<boolean>(true);
  const [dueDate, setDueDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => [{ id: uid("dl"), itemId: "", qty: "1", unitPrice: "" }]);

  // Payment modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  // Delete modal
  const [delSale, setDelSale] = useState<Sale | null>(null);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  // Preselect customer from Kunder-tab
  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  // Keep list compact: reset "show more" when filter changes
  useEffect(() => {
    setVisibleCount(5);
  }, [onlyUnpaid]);

  const outstandingTotal = useMemo(() => round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0)), [sales]);

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

        // Auto price from item if empty
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

    // Update stock locally
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

    // Low stock warning
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

  function togglePaid(s: Sale) {
    setSalePaid(s.id, !Boolean(s.paid));
  }

  function showMore() {
    setVisibleCount((n) => Math.min(filteredSales.length, n + 10));
  }

  function doDelete(restoreStock: boolean) {
    if (!delSale) return;
    removeSale(delSale.id, restoreStock);
    setDelSale(null);
  }

  const sortedCustomers = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }));
    return copy;
  }, [customers]);

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        Utestående salg totalt: <b>{fmtKr(outstandingTotal)}</b>
      </div>

      <div className="btnRow" style={{ justifyContent: "space-between" }}>
        <button className="btn btnPrimary" type="button" onClick={openNewSale}>
          + Nytt salg
        </button>

        <button className="btn" type="button" onClick={() => setOnlyUnpaid((v) => !v)}>
          {onlyUnpaid ? "Vis alle" : "Vis kun utestående"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Liste</div>
        <div className="cardSub">
          Viser <b>{Math.min(visibleCount, filteredSales.length)}</b> av <b>{filteredSales.length}</b>
        </div>

        <div className="list">
          {visibleSales.map((s) => {
            const paidSum = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const paid = isPaid(s);

            const lines = Array.isArray(s.lines) ? s.lines : [];
            const preview = lines.slice(0, 3).map(fmtLineCompact);

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div className="itemTop">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <p className="itemTitle" style={{ marginBottom: 0 }}>
                        {s.customerName ? s.customerName : "Anonym"}
                      </p>
                      <span className={`chip ${paid ? "chipPaid" : "chipUnpaid"}`}>
                        {paid ? "Betalt" : "Utestående"}
                      </span>
                    </div>

                    <div className="itemMeta" style={{ marginTop: 6 }}>
                      Total: <b>{fmtKr(s.total)}</b> • Innbetalt: <b>{fmtKr(paidSum)}</b> •{" "}
                      <span style={{ color: paid ? "var(--good)" : "var(--bad)", fontWeight: 900 }}>
                        Utestående: {fmtKr(rem)}
                      </span>
                      {" • "}
                      {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>

                    {preview.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Kjøpt:</b>
                        <div style={{ marginTop: 4, opacity: 0.95 }}>
                          {preview.map((t, i) => (
                            <div key={i}>• {t}</div>
                          ))}
                          {lines.length > 3 ? (
                            <div style={{ marginTop: 2, opacity: 0.9 }}>… +{lines.length - 3} til</div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {s.note ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        Notat: <b>{s.note}</b>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : null}

                  <button className="btn" type="button" onClick={() => togglePaid(s)}>
                    {s.paid ? "Marker ubetalt" : "Marker betalt"}
                  </button>

                  <button className="btn btnDanger" type="button" onClick={() => setDelSale(s)}>
                    Slett
                  </button>
                </div>
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
      <Modal open={newOpen} title="Nytt salg" onClose={() => setNewOpen(false)}>
        <div className="saleModal">
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div>
              <label className="label">Kunde (valgfritt)</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Ingen / anonymt salg…</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="row3">
              <div>
                <label className="label">Betalt?</label>
                <select
                  className="input"
                  value={paidFlag ? "paid" : "unpaid"}
                  onChange={(e) => setPaidFlag(e.target.value === "paid")}
                >
                  <option value="paid">Betalt</option>
                  <option value="unpaid">Ubetalt</option>
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
          </div>

          <div style={{ height: 12 }} />

          <div className="saleLines">
            {draftLines.map((dl, idx) => {
              const it = items.find((x) => x.id === dl.itemId) ?? null;
              const lineSum = round2(toInt(dl.qty) * toNum(dl.unitPrice || (it ? String(it.price ?? 0) : "0")));

              return (
                <div key={dl.id} className="saleLineCard">
                  <div className="saleLineHeader">
                    <div className="saleLineTitle">Varelinje {idx + 1}</div>
                    <button className="btn" type="button" onClick={() => removeDraftLine(dl.id)} disabled={draftLines.length <= 1}>
                      Fjern
                    </button>
                  </div>

                  <div className="saleLineGrid">
                    <div className="saleLineColWide">
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

                    <div className="saleLineCol">
                      <label className="label">Antall</label>
                      <input className="input" inputMode="numeric" value={dl.qty} onChange={(e) => updateLine(dl.id, { qty: e.target.value })} />
                    </div>

                    <div className="saleLineCol">
                      <label className="label">Pris</label>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={dl.unitPrice}
                        onChange={(e) => updateLine(dl.id, { unitPrice: e.target.value })}
                        placeholder={it ? String(it.price ?? 0) : "0"}
                      />
                    </div>

                    <div className="saleLineCol">
                      <label className="label">Sum</label>
                      <input className="input" value={fmtKr(lineSum)} readOnly />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="btnRow" style={{ marginTop: 10 }}>
              <button className="btn" type="button" onClick={addDraftLine}>
                + Legg til varelinje
              </button>
            </div>
          </div>

          <div className="saleModalSticky">
            <div className="saleModalTotal">
              Total: <b>{fmtKr(draftTotal)}</b>
            </div>

            <div className="btnRow" style={{ marginTop: 0, justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={() => setNewOpen(false)}>
                Avbryt
              </button>
              <button className="btn btnPrimary" type="button" onClick={saveNewSale}>
                Lagre salg
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal open={!!paySale} title="Registrer innbetaling" onClose={() => setPaySale(null)}>
        {paySale ? (
          <div className="fieldGrid" style={{ marginTop: 0 }}>
            <div className="itemMeta" style={{ marginTop: 0 }}>
              <b>{paySale.customerName ? paySale.customerName : "Anonym"}</b> • Utestående nå:{" "}
              <b style={{ color: "var(--bad)" }}>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
                Lagre
              </button>
              <button className="btn" type="button" onClick={() => setPaySale(null)}>
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* DELETE MODAL */}
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
