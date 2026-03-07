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
  Vare,
  Sale,
  SaleLine,
} from "../app/storage";

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

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale } = useSales();

  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [customerId, setCustomerId] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [paidDefault, setPaidDefault] = useState<boolean>(true);

  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const [delSale, setDelSale] = useState<Sale | null>(null);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    if (unitPrice.trim() === "") setUnitPrice(String(selectedItem.price ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  const total = useMemo(() => {
    const q = Math.trunc(toNum(qty));
    const p = toNum(unitPrice || (selectedItem?.price ? String(selectedItem.price) : "0"));
    return round2(q * p);
  }, [qty, unitPrice, selectedItem]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  function doSale() {
    if (!selectedItem) return alert("Velg en vare først.");

    const q = Math.trunc(toNum(qty));
    if (q <= 0) return alert("Antall må være minst 1.");

    const p = toNum(unitPrice || String(selectedItem.price ?? 0));

    const itemsNow = getItems();
    const idx = itemsNow.findIndex((x) => x.id === selectedItem.id);
    if (idx < 0) return alert("Fant ikke varen i lageret.");

    const newStock = (itemsNow[idx].stock ?? 0) - q;
    itemsNow[idx] = { ...itemsNow[idx], stock: newStock, updatedAt: new Date().toISOString() };
    setItems(itemsNow);

    const line: SaleLine = {
      id: uid("line"),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty: q,
      unitPrice: round2(p),
      unitCostAtSale: Number.isFinite(Number(selectedItem.cost)) ? Number(selectedItem.cost) : undefined,
    };

    addSale({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      lines: [line],
      paid: paidDefault, // ✅ default true
    });

    const min = itemsNow[idx].minStock ?? 0;
    if (min > 0 && newStock <= min) setLowPopup({ item: itemsNow[idx], newStock });

    setQty("1");
    setUnitPrice("");
    setItemId("");
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

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        Registrer salg. Lager trekkes automatisk. <b>Utestående salg totalt:</b> <b>{fmtKr(outstandingTotal)}</b>
      </div>

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

        <div>
          <label className="label">Vare</label>
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Velg vare…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} (lager: {i.stock}, min: {i.minStock})
              </option>
            ))}
          </select>
        </div>

        <div className="row3">
          <div>
            <label className="label">Antall</label>
            <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="label">Pris pr stk (kr)</label>
            <input
              className="input"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={selectedItem ? String(selectedItem.price ?? 0) : "0"}
            />
          </div>
          <div>
            <label className="label">Sum</label>
            <input className="input" value={fmtKr(total)} readOnly />
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <select className="input" value={paidDefault ? "paid" : "unpaid"} onChange={(e) => setPaidDefault(e.target.value === "paid")}>
            <option value="paid">Betalt (default)</option>
            <option value="unpaid">Ikke betalt</option>
          </select>
        </div>

        <div className="btnRow">
          <button className="btn btnPrimary" type="button" onClick={doSale}>
            Registrer salg
          </button>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Siste salg</div>
        <div className="cardSub">Viser siste 25 • delbetaling/utestående • toggle betalt • slett</div>

        <div className="list">
          {sales.slice(0, 25).map((s) => {
            const paid = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const first = s.lines?.[0];

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">
                      {s.lines?.length > 1 ? `${s.lines.length} varer` : first ? first.itemName : "Salg"}
                    </p>

                    <div className="itemMeta">
                      Sum: <b>{fmtKr(s.total)}</b>
                      {s.customerName ? (
                        <>
                          {" "}
                          • Kunde: <b>{s.customerName}</b>
                        </>
                      ) : null}
                    </div>

                    {s.lines?.length ? (
                      <div className="itemMeta" style={{ marginTop: 6 }}>
                        <b>Linjer:</b>
                        {s.lines.slice(0, 3).map((l) => (
                          <div key={l.id} style={{ marginTop: 4 }}>
                            • {l.itemName} × <b>{l.qty}</b> á <b>{fmtKr(l.unitPrice)}</b>
                          </div>
                        ))}
                        {s.lines.length > 3 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{s.lines.length - 3} til</div> : null}
                      </div>
                    ) : null}

                    <div className="itemMeta" style={{ marginTop: 8 }}>
                      Innbetalt: <b>{fmtKr(paid)}</b> • Utestående: <b>{fmtKr(rem)}</b> • {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>
                  </div>
                </div>

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : null}

                  <button className="btn" type="button" onClick={() => setSalePaid(s.id, !s.paid)}>
                    {s.paid ? "Marker ubetalt" : "Marker betalt"}
                  </button>

                  <button className="btn btnDanger" type="button" onClick={() => askDelete(s)}>
                    Slett
                  </button>
                </div>
              </div>
            );
          })}

          {sales.length === 0 ? <div className="item">Ingen salg enda.</div> : null}
        </div>
      </div>

      <Modal open={!!lowPopup} title="⚠️ Lav lagerbeholdning" onClose={() => setLowPopup(null)}>
        {lowPopup ? (
          <div>
            <div style={{ marginBottom: 10 }}>
              <b>{lowPopup.item.name}</b>
            </div>
            <div>
              Ny beholdning: <b>{lowPopup.newStock}</b> • Minimum: <b>{lowPopup.item.minStock}</b>
            </div>
            <div style={{ marginTop: 10, opacity: 0.9 }}>
              Tips: Gå til <b>Varer</b> og øk lager, eller juster minimum per vare.
            </div>
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
              <b>{paySale.customerName || "Salg"}</b> • Utestående: <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
            Sum: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varer skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
