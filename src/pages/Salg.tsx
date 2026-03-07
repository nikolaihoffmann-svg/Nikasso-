// src/pages/Salg.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addSale,
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
  const { sales, removeSale, setPaid } = useSales();

  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [customerId, setCustomerId] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [paidDefault, setPaidDefault] = useState<boolean>(true);

  const [cart, setCart] = useState<SaleLine[]>([]);
  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  // slett modal
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

  const lineTotal = useMemo(() => {
    const q = Math.trunc(toNum(qty));
    const p = toNum(unitPrice || (selectedItem?.price ? String(selectedItem.price) : "0"));
    return round2(q * p);
  }, [qty, unitPrice, selectedItem]);

  const cartTotal = useMemo(() => round2(cart.reduce((a, l) => a + round2(l.qty * l.unitPrice), 0)), [cart]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  function addLineToCart() {
    if (!selectedItem) return alert("Velg en vare først.");
    const q = Math.trunc(toNum(qty));
    if (q <= 0) return alert("Antall må være minst 1.");
    const p = toNum(unitPrice || String(selectedItem.price ?? 0));

    const itemsNow = getItems();
    const it = itemsNow.find((x) => x.id === selectedItem.id);
    const unitCostAtSale = it ? Number(it.cost ?? 0) : 0;

    const line: SaleLine = {
      id: uid("line"),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty: q,
      unitPrice: round2(p),
      unitCostAtSale: Number.isFinite(unitCostAtSale) ? unitCostAtSale : 0,
    };

    setCart((prev) => [line, ...prev]);

    // reset inputs (men behold kunde)
    setQty("1");
    setUnitPrice("");
    setItemId("");
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.id !== lineId));
  }

  function doSale() {
    if (cart.length === 0) return alert("Legg til minst én vare i salget (Trykk «+ Legg til vare»).");

    // trekk lager per linje
    const itemsNow = getItems();

    for (const l of cart) {
      const idx = itemsNow.findIndex((x) => x.id === l.itemId);
      if (idx < 0) return alert(`Fant ikke varen i lageret: ${l.itemName}`);
      const newStock = (itemsNow[idx].stock ?? 0) - Math.trunc(l.qty);
      itemsNow[idx] = { ...itemsNow[idx], stock: newStock, updatedAt: new Date().toISOString() };

      const min = itemsNow[idx].minStock ?? 0;
      if (min > 0 && newStock <= min) setLowPopup({ item: itemsNow[idx], newStock });
    }

    setItems(itemsNow);

    addSale({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      lines: cart,
      paid: paidDefault, // ✅ default betalt
      payments: [], // delbetalinger kan registreres senere
    });

    setCart([]);
    // kundevalg lar vi stå
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
        Legg varer i et salg, registrer, og følg utestående. <b>Utestående salg totalt:</b> <b>{fmtKr(outstandingTotal)}</b>
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
            <label className="label">Sum (linje)</label>
            <input className="input" value={fmtKr(lineTotal)} readOnly />
          </div>
        </div>

        <div className="btnRow">
          <button className="btn" type="button" onClick={addLineToCart}>
            + Legg til vare
          </button>

          <label className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={paidDefault}
              onChange={(e) => setPaidDefault(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Betalt
          </label>

          <button className="btn btnPrimary" type="button" onClick={doSale}>
            Registrer salg ({fmtKr(cartTotal)})
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Dette salget</div>
        <div className="cardSub">Varer du har lagt til før du trykker “Registrer salg”.</div>

        <div className="list">
          {cart.length === 0 ? (
            <div className="item">Ingen varer lagt til enda.</div>
          ) : (
            cart.map((l) => (
              <div key={l.id} className="item">
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{l.itemName}</p>
                    <div className="itemMeta">
                      Antall: <b>{l.qty}</b> • Pris: <b>{fmtKr(l.unitPrice)}</b> • Sum: <b>{fmtKr(round2(l.qty * l.unitPrice))}</b>
                    </div>
                  </div>
                </div>
                <div className="itemActions">
                  <button className="btn btnDanger" type="button" onClick={() => removeLine(l.id)}>
                    Fjern
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Siste salg</div>
        <div className="cardSub">Viser siste 25 • trykk for betalt/ubetalt eller slett</div>

        <div className="list">
          {sales.slice(0, 25).map((s) => {
            const paidSum = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const lines = Array.isArray(s.lines) ? s.lines : [];

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{s.customerName ? s.customerName : "Anonymt salg"}</p>
                    <div className="itemMeta">
                      Total: <b>{fmtKr(s.total)}</b> • Innbetalt: <b>{fmtKr(paidSum)}</b> • Utestående: <b>{fmtKr(rem)}</b> •{" "}
                      {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>

                    <div className="itemMeta" style={{ marginTop: 10 }}>
                      <b>Varer:</b>
                      {lines.slice(0, 6).map((l) => (
                        <div key={l.id} style={{ marginTop: 4 }}>
                          • {l.itemName} — {l.qty} stk × {fmtKr(l.unitPrice)} = <b>{fmtKr(round2(l.qty * l.unitPrice))}</b>
                        </div>
                      ))}
                      {lines.length > 6 ? <div style={{ marginTop: 6, opacity: 0.9 }}>… +{lines.length - 6} til</div> : null}
                    </div>
                  </div>
                </div>

                <div className="itemActions">
                  {s.paid ? (
                    <button className="btn" type="button" onClick={() => setPaid(s.id, false)}>
                      Marker som ubetalt
                    </button>
                  ) : (
                    <button className="btn btnPrimary" type="button" onClick={() => setPaid(s.id, true)}>
                      Marker som betalt
                    </button>
                  )}

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
            Total: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varene skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
