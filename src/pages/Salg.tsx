// src/pages/Salg.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addSale,
  clearSaleDraftCustomer,
  fmtKr,
  getItems,
  getSaleDraftCustomer,
  round2,
  setItems,
  useCustomers,
  useItems,
  useSales,
  Vare,
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

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales } = useSales();

  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [customerId, setCustomerId] = useState<string>(""); // dropdown (valgfri)
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  // Hvis vi kom fra "Kunder → nytt salg": draft er en string id
  useEffect(() => {
    const draftCustomerId = getSaleDraftCustomer();
    if (draftCustomerId) {
      setCustomerId(draftCustomerId);
      clearSaleDraftCustomer();
    }
  }, []);

  // autopopulate pris ved valg av vare (kun hvis feltet er tomt)
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

    addSale({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty: q,
      unitPrice: round2(p),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
    });

    const min = itemsNow[idx].minStock ?? 0;
    if (min > 0 && newStock <= min) setLowPopup({ item: itemsNow[idx], newStock });

    setQty("1");
    setUnitPrice("");
    setItemId("");
    // kundevalg lar vi stå (ofte samme kunde flere salg)
  }

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        Registrer salg. Lager trekkes automatisk, og du får varsel når lager når minimum (per vare).
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

        <div className="btnRow">
          <button className="btn btnPrimary" type="button" onClick={doSale}>
            Registrer salg
          </button>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Siste salg</div>
        <div className="list">
          {sales.slice(0, 25).map((s) => (
            <div key={s.id} className="item">
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{s.itemName}</p>
                  <div className="itemMeta">
                    Antall: <b>{s.qty}</b> • Pris: <b>{fmtKr(s.unitPrice)}</b> • Sum: <b>{fmtKr(s.total)}</b>
                    {s.customerName ? (
                      <>
                        {" "}
                        • Kunde: <b>{s.customerName}</b>
                      </>
                    ) : null}
                  </div>
                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    {new Date(s.createdAt).toLocaleString("nb-NO")}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  );
}
