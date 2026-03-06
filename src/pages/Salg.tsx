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

type CartLine = {
  itemId: string;
  qty: string;
  unitPrice: string;
};

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, addPayment, setPaid, removeSale } = useSales();

  const [customerId, setCustomerId] = useState<string>("");

  // ✅ Handlekurv
  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paidAtSave, setPaidAtSave] = useState(true);

  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  // betaling modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  // slett modal
  const [delSale, setDelSale] = useState<Sale | null>(null);

  // søk/vis flere
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  // forhåndsvalg kunde
  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  // autopopulate pris
  useEffect(() => {
    if (!selectedItem) return;
    if (unitPrice.trim() === "") setUnitPrice(String(selectedItem.price ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  const cartPreview = useMemo(() => {
    const lines = cart.map((c) => {
      const it = items.find((x) => x.id === c.itemId);
      const name = it?.name ?? "Ukjent";
      const q = Math.trunc(toNum(c.qty));
      const p = toNum(c.unitPrice);
      const total = round2(q * p);
      return { ...c, name, q, p, total };
    });
    const sum = round2(lines.reduce((a, l) => a + l.total, 0));
    return { lines, sum };
  }, [cart, items]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  function addToCart() {
    if (!selectedItem) return alert("Velg en vare først.");
    const q = Math.trunc(toNum(qty));
    if (q <= 0) return alert("Antall må være minst 1.");
    const p = toNum(unitPrice || String(selectedItem.price ?? 0));

    setCart((prev) => [{ itemId: selectedItem.id, qty: String(q), unitPrice: String(round2(p)) }, ...prev]);

    // reset
    setItemId("");
    setQty("1");
    setUnitPrice("");
  }

  function removeCartLine(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function doSale() {
    if (cart.length === 0) return alert("Legg til minst én vare i salget.");

    // trekk lager
    const itemsNow = getItems();
    const byId = new Map(itemsNow.map((it) => [it.id, it] as const));

    // bygg linjer
    const lines: Omit<SaleLine, "id" | "lineTotal">[] = cart.map((c) => {
      const it = byId.get(c.itemId);
      const name = it?.name ?? "Ukjent";
      const q = Math.trunc(toNum(c.qty));
      const p = round2(toNum(c.unitPrice || "0"));
      return {
        itemId: c.itemId,
        itemName: name,
        qty: q,
        unitPrice: p,
        unitCostAtSale: it ? Number(it.cost ?? 0) : undefined,
      };
    });

    // lagerjustering
    for (const l of lines) {
      const it = byId.get(l.itemId);
      if (!it) continue;
      const newStock = (it.stock ?? 0) - (l.qty ?? 0);
      it.stock = newStock;
      it.updatedAt = new Date().toISOString();

      const min = it.minStock ?? 0;
      if (min > 0 && newStock <= min) setLowPopup({ item: it, newStock });
    }

    setItems(Array.from(byId.values()));

    addSale({
      itemId: lines[0]?.itemId ?? "",
      itemName: lines.length > 1 ? `Flere varer (${lines.length})` : (lines[0]?.itemName ?? "Salg"),
      qty: lines.reduce((a, l) => a + (l.qty ?? 0), 0),
      unitPrice: lines.length === 1 ? lines[0].unitPrice : 0,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      paid: paidAtSave, // ✅ default true
      payments: [],
      lines,
    });

    // reset
    setCart([]);
    setPaidAtSave(true);
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

    // via useSales
    addPayment(paySale.id, a, payNote.trim() || undefined, iso);
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

  const filteredSales = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = sales;

    if (!qq) return base.slice(0, limit);

    const matches = base.filter((s) => {
      const lineText = (Array.isArray(s.lines) ? s.lines : [])
        .map((l) => `${l.itemName} ${l.qty} ${l.unitPrice}`)
        .join(" ");
      const hay = `${s.itemName} ${s.customerName ?? ""} ${lineText}`.toLowerCase();
      return hay.includes(qq);
    });

    return matches.slice(0, limit);
  }, [sales, q, limit]);

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        <b>Utestående salg totalt:</b> <b>{fmtKr(outstandingTotal)}</b>
      </div>

      {/* Kunde */}
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
      </div>

      {/* Legg i handlekurv */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 10 }}>
          Nytt salg
        </div>

        <div className="fieldGrid" style={{ marginTop: 0 }}>
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
              <label className="label">Legg til</label>
              <button className="btn btnPrimary" type="button" onClick={addToCart} style={{ width: "100%" }}>
                + I salget
              </button>
            </div>
          </div>

          {/* Betalt toggle før lagring */}
          <div className="itemMeta" style={{ marginTop: 2 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={paidAtSave} onChange={(e) => setPaidAtSave(e.target.checked)} />
              Lagre som <b>{paidAtSave ? "Betalt" : "Ubetalt"}</b> (default: betalt)
            </label>
          </div>

          {/* Kurv */}
          <div className="card" style={{ marginTop: 8 }}>
            <div className="cardTitle" style={{ fontSize: 16, marginBottom: 8 }}>
              Varer i salget
            </div>

            {cartPreview.lines.length === 0 ? (
              <div className="itemMeta">Ingen varer lagt til enda.</div>
            ) : (
              <div className="list" style={{ marginTop: 0 }}>
                {cartPreview.lines.map((l, idx) => (
                  <div key={idx} className="item">
                    <div className="itemTop">
                      <div>
                        <p className="itemTitle">{l.name}</p>
                        <div className="itemMeta">
                          Antall: <b>{l.q}</b> • Pris: <b>{fmtKr(l.p)}</b> • Linjesum: <b>{fmtKr(l.total)}</b>
                        </div>
                      </div>
                      <button className="btn btnDanger" type="button" onClick={() => removeCartLine(idx)}>
                        Fjern
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="itemMeta" style={{ marginTop: 10 }}>
              Sum: <b>{fmtKr(cartPreview.sum)}</b>
              {selectedCustomer?.name ? (
                <>
                  {" "}
                  • Kunde: <b>{selectedCustomer.name}</b>
                </>
              ) : null}
            </div>

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" type="button" onClick={doSale} disabled={cartPreview.lines.length === 0}>
                Registrer salg
              </button>
              <button className="btn" type="button" onClick={() => setCart([])} disabled={cartPreview.lines.length === 0}>
                Tøm
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* Salgs-lista */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Salg</div>
        <div className="cardSub">Søk, delbetaling, utestående, slett + marker betalt/ubetalt.</div>

        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i salg (kunde, vare…)" />

        <div className="list">
          {filteredSales.map((s) => {
            const paid = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const isUnpaid = rem > 0;

            const lines = Array.isArray(s.lines) ? s.lines : [];
            const customer = s.customerName ?? "Anonym";

            return (
              <div key={s.id} className={isUnpaid ? "item low" : "item"}>
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{customer}</p>

                    <div className="itemMeta">
                      Total: <b>{fmtKr(s.total)}</b> • Innbetalt: <b>{fmtKr(paid)}</b> • Utestående: <b>{fmtKr(rem)}</b>
                      {" • "}
                      {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>

                    {/* Hva kunden kjøpte */}
                    {lines.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Kjøpt:</b>
                        {lines.slice(0, 6).map((l) => (
                          <div key={l.id} style={{ marginTop: 4 }}>
                            • {l.itemName} — <b>{l.qty} stk</b> × <b>{fmtKr(l.unitPrice)}</b> = <b>{fmtKr(l.lineTotal)}</b>
                          </div>
                        ))}
                        {lines.length > 6 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{lines.length - 6} til</div> : null}
                      </div>
                    ) : null}

                    {/* Innbetalinger */}
                    {Array.isArray(s.payments) && s.payments.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Innbetalinger:</b>
                        {s.payments.slice(0, 4).map((p) => (
                          <div key={p.id} style={{ marginTop: 4 }}>
                            • {new Date(p.createdAt).toLocaleDateString("nb-NO")} – <b>{fmtKr(p.amount)}</b>
                            {p.note ? <> ({p.note})</> : null}
                          </div>
                        ))}
                        {s.payments.length > 4 ? (
                          <div style={{ marginTop: 4, opacity: 0.9 }}>… +{s.payments.length - 4} til</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="itemActions">
                  {isUnpaid ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : (
                    <button className="btn" type="button" onClick={() => openPayment(s)}>
                      Legg til innbetaling
                    </button>
                  )}

                  {/* ✅ toggle betalt/ubetalt etter lagring */}
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

        <div className="btnRow" style={{ marginTop: 12, justifyContent: "center" }}>
          {limit < sales.length ? (
            <button className="btn" type="button" onClick={() => setLimit((x) => x + 25)}>
              Vis flere
            </button>
          ) : null}
          {limit > 25 ? (
            <button className="btn" type="button" onClick={() => setLimit(25)}>
              Vis færre
            </button>
          ) : null}
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
              <b>{paySale.customerName ?? "Anonym"}</b> • Total: <b>{fmtKr(paySale.total)}</b> • Utestående:{" "}
              <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
            Kunde: <b>{delSale.customerName ?? "Anonym"}</b>
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
