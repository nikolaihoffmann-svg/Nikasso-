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
  useCustomers,
  useItems,
  useSales,
  Vare,
  Sale,
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

type DraftLine = {
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  unitCostAtSale: number;
};

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale } = useSales();

  // Draft inputs
  const [customerId, setCustomerId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("");

  // Draft cart
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [paidDefault, setPaidDefault] = useState(true);

  const [lowPopup, setLowPopup] = useState<{ item: Vare; newStock: number } | null>(null);

  // betaling modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("0");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [payNote, setPayNote] = useState("");

  // slett modal med 2 valg
  const [delSale, setDelSale] = useState<Sale | null>(null);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  // forhåndsvalg kunde fra Kunder-siden
  useEffect(() => {
    const draft = getSaleDraftCustomer();
    if (draft) {
      setCustomerId(draft);
      clearSaleDraftCustomer();
    }
  }, []);

  // autopopulate pris ved valg av vare (kun hvis feltet er tomt)
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

  const draftTotal = useMemo(() => {
    return round2(draftLines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  }, [draftLines]);

  const outstandingTotal = useMemo(() => {
    return round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
  }, [sales]);

  function addLineToDraft() {
    if (!selectedItem) return alert("Velg en vare først.");

    const q = Math.trunc(toNum(qty));
    if (q <= 0) return alert("Antall må være minst 1.");

    const p = toNum(unitPrice || String(selectedItem.price ?? 0));

    setDraftLines((prev) => [
      ...prev,
      {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        qty: q,
        unitPrice: round2(p),
        unitCostAtSale: round2(Number(selectedItem.cost ?? 0)),
      },
    ]);

    setQty("1");
    setUnitPrice("");
    setItemId("");
  }

  function removeDraftLine(index: number) {
    setDraftLines((prev) => prev.filter((_, i) => i !== index));
  }

  function doSale() {
    if (draftLines.length === 0) return alert("Legg til minst én vare i salget først.");

    // trekk lager for alle lines
    const itemsNow = getItems();
    const byId = new Map(itemsNow.map((x) => [x.id, x]));
    const now = new Date().toISOString();

    // først valider
    for (const l of draftLines) {
      const it = byId.get(l.itemId);
      if (!it) return alert(`Fant ikke varen i lageret: ${l.itemName}`);
      const newStock = (it.stock ?? 0) - l.qty;
      // tillat negativt hvis du vil – men dette er en fin sikkerhet:
      // if (newStock < 0) return alert(`Ikke nok på lager for ${it.name}.`);
      byId.set(l.itemId, { ...it, stock: newStock, updatedAt: now });
    }

    // lagre lager
    setItems(Array.from(byId.values()));

    // lagre salg
    addSale({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      lines: draftLines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        unitCostAtSale: l.unitCostAtSale,
      })),
      paid: paidDefault, // default betalt ✅
    });

    // low stock popup: sjekk alle berørte varer
    for (const l of draftLines) {
      const it = byId.get(l.itemId);
      if (!it) continue;
      const min = it.minStock ?? 0;
      if (min > 0 && (it.stock ?? 0) <= min) {
        setLowPopup({ item: it, newStock: it.stock ?? 0 });
        break;
      }
    }

    // reset draft
    setDraftLines([]);
    setPaidDefault(true);
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

  function renderSaleTitle(s: Sale) {
    if (!s.lines || s.lines.length === 0) return "Salg";
    if (s.lines.length === 1) return s.lines[0].itemName;
    return `${s.lines[0].itemName} + ${s.lines.length - 1} til`;
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
            <label className="label">Sum (linje)</label>
            <input className="input" value={fmtKr(lineTotal)} readOnly />
          </div>
        </div>

        <div className="btnRow">
          <button className="btn" type="button" onClick={addLineToDraft}>
            Legg til vare
          </button>
        </div>

        {/* Draft cart */}
        <div className="card" style={{ marginTop: 0 }}>
          <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
            Dette salget
          </div>

          {draftLines.length === 0 ? (
            <div className="item">Ingen varer lagt til enda.</div>
          ) : (
            <div className="list">
              {draftLines.map((l, idx) => (
                <div key={`${l.itemId}-${idx}`} className="item">
                  <p className="itemTitle">{l.itemName}</p>
                  <div className="itemMeta">
                    Antall: <b>{l.qty}</b> • Pris: <b>{fmtKr(l.unitPrice)}</b> • Sum: <b>{fmtKr(l.qty * l.unitPrice)}</b>
                  </div>
                  <div className="itemActions">
                    <button className="btn btnDanger" type="button" onClick={() => removeDraftLine(idx)}>
                      Fjern
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="itemMeta" style={{ marginTop: 10 }}>
            Totalt: <b>{fmtKr(draftTotal)}</b>
          </div>

          <div className="itemMeta" style={{ marginTop: 10 }}>
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={paidDefault} onChange={(e) => setPaidDefault(e.target.checked)} />
              <span>Betalt (default)</span>
            </label>
          </div>

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button className="btn btnPrimary" type="button" onClick={doSale}>
              Lagre salg
            </button>
            <button className="btn" type="button" onClick={() => setDraftLines([])} disabled={draftLines.length === 0}>
              Tøm
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Siste salg</div>
        <div className="cardSub">Viser siste 25 • du kan endre betalt/ubetalt • innbetaling • slette</div>

        <div className="list">
          {sales.slice(0, 25).map((s) => {
            const paidSum = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));
            const isPaid = s.paid || rem <= 0;

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div className="itemTop">
                  <div>
                    <p className="itemTitle">{renderSaleTitle(s)}</p>

                    <div className="itemMeta">
                      Sum: <b>{fmtKr(s.total)}</b>
                      {s.customerName ? (
                        <>
                          {" "}
                          • Kunde: <b>{s.customerName}</b>
                        </>
                      ) : null}
                      {" • "}
                      {new Date(s.createdAt).toLocaleString("nb-NO")}
                    </div>

                    {/* Lines */}
                    {Array.isArray(s.lines) && s.lines.length > 0 ? (
                      <div className="itemMeta" style={{ marginTop: 8 }}>
                        <b>Varer:</b>
                        {s.lines.slice(0, 6).map((l) => (
                          <div key={l.id} style={{ marginTop: 4 }}>
                            • {l.itemName} — <b>{l.qty}</b> stk × <b>{fmtKr(l.unitPrice)}</b> ={" "}
                            <b>{fmtKr(l.qty * l.unitPrice)}</b>
                          </div>
                        ))}
                        {s.lines.length > 6 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{s.lines.length - 6} til</div> : null}
                      </div>
                    ) : null}

                    <div className="itemMeta" style={{ marginTop: 8 }}>
                      Status: <b>{isPaid ? "Betalt" : "Ubetalt"}</b> • Innbetalt: <b>{fmtKr(paidSum)}</b> • Utestående:{" "}
                      <b>{fmtKr(rem)}</b>
                    </div>

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
                  {/* Toggle paid/unpaid */}
                  {isPaid ? (
                    <button className="btn" type="button" onClick={() => setSalePaid(s.id, false)}>
                      Marker som ubetalt
                    </button>
                  ) : (
                    <button className="btn" type="button" onClick={() => setSalePaid(s.id, true)}>
                      Marker som betalt
                    </button>
                  )}

                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : null}

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
              <b>{renderSaleTitle(paySale)}</b>
              {paySale.customerName ? (
                <>
                  {" "}
                  • Kunde: <b>{paySale.customerName}</b>
                </>
              ) : null}{" "}
              • Utestående: <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
            <b>{renderSaleTitle(delSale)}</b>
            <br />
            Sum: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varene skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
