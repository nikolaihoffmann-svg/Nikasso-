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
  qty: string;
  unitPrice: string;
  unitCostAtSale?: number;
};

export function Salg() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales, removeSale } = useSales();

  const [customerId, setCustomerId] = useState<string>("");

  // Draft "cart"
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("");

  // default betalt
  const [paidDefault, setPaidDefault] = useState<boolean>(true);

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

  const draftTotal = useMemo(() => {
    const sum = draftLines.reduce((a, l) => {
      const q = Math.trunc(toNum(l.qty));
      const p = toNum(l.unitPrice);
      return a + round2(q * p);
    }, 0);
    return round2(sum);
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
        qty: String(q),
        unitPrice: String(round2(p)),
        unitCostAtSale: Number.isFinite(Number(selectedItem.cost)) ? Number(selectedItem.cost) : undefined,
      },
    ]);

    setItemId("");
    setQty("1");
    setUnitPrice("");
  }

  function removeDraftLine(idx: number) {
    setDraftLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function doSale() {
    if (draftLines.length === 0) return alert("Legg til minst 1 vare i salget først.");

    // trekk lager for alle lines
    const itemsNow = getItems();
    const map = new Map(itemsNow.map((it) => [it.id, it] as const));

    for (const l of draftLines) {
      const it = map.get(l.itemId);
      if (!it) return alert(`Fant ikke vare i lager: ${l.itemName}`);
      const q = Math.trunc(toNum(l.qty));
      it.stock = Math.trunc((it.stock ?? 0) - q);
      it.updatedAt = new Date().toISOString();

      const min = it.minStock ?? 0;
      if (min > 0 && it.stock <= min) {
        // viser bare siste som trigges
        setLowPopup({ item: it, newStock: it.stock });
      }
    }

    setItems(Array.from(map.values()));

    addSale({
      lines: draftLines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        qty: Math.trunc(toNum(l.qty)),
        unitPrice: round2(toNum(l.unitPrice)),
        unitCostAtSale: Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : undefined,
      })),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      payments: [],
      paid: paidDefault, // ✅ default betalt
    });

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

  function togglePaid(s: Sale) {
    setSalePaid(s.id, !s.paid);
  }

  return (
    <div className="card">
      <div className="cardTitle">Salg</div>
      <div className="cardSub">
        Registrer salg. Lager trekkes automatisk. <b>Utestående salg totalt:</b> <b>{fmtKr(outstandingTotal)}</b>
      </div>

      {/* Draft / cart */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardTitle">Nytt salg</div>
        <div className="cardSub">Legg til flere varer i samme salg. Default: betalt.</div>

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
              <label className="label">Vare</label>
              <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
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
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={addLineToDraft}>
              Legg til vare
            </button>

            <button
              className={`btn ${paidDefault ? "btnPrimary" : ""}`}
              type="button"
              onClick={() => setPaidDefault((p) => !p)}
              title="Default status for salget"
            >
              {paidDefault ? "✅ Betalt (default)" : "⏳ Ubetalt (default)"}
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div className="list">
          {draftLines.length === 0 ? (
            <div className="item">Ingen varer lagt til enda.</div>
          ) : (
            draftLines.map((l, idx) => {
              const q = Math.trunc(toNum(l.qty));
              const p = toNum(l.unitPrice);
              const lineTotal = round2(q * p);

              return (
                <div key={`${l.itemId}-${idx}`} className="item">
                  <div>
                    <p className="itemTitle">{l.itemName}</p>
                    <div className="itemMeta">
                      Antall: <b>{q}</b> • Pris: <b>{fmtKr(p)}</b> • Sum: <b>{fmtKr(lineTotal)}</b>
                    </div>
                  </div>
                  <div className="itemActions">
                    <button className="btn btnDanger" type="button" onClick={() => removeDraftLine(idx)}>
                      Fjern
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Total: <b>{fmtKr(draftTotal)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={doSale} disabled={draftLines.length === 0}>
            Lagre salg
          </button>
          <button className="btn" type="button" onClick={() => setDraftLines([])} disabled={draftLines.length === 0}>
            Tøm
          </button>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* List */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Siste salg</div>
        <div className="cardSub">Viser siste 25 • kan være betalt/ubetalt • delbetaling • kan slettes</div>

        <div className="list">
          {sales.slice(0, 25).map((s) => {
            const paidSum = salePaidSum(s);
            const rem = Math.max(0, saleRemaining(s));

            return (
              <div key={s.id} className={rem > 0 ? "item low" : "item"}>
                <div>
                  <p className="itemTitle">
                    {s.customerName ? s.customerName : "Anonym"} • <span style={{ opacity: 0.9 }}>{fmtKr(s.total)}</span>
                  </p>

                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    {Array.isArray(s.lines) && s.lines.length > 0 ? (
                      <>
                        <b>Varer:</b>{" "}
                        {s.lines
                          .slice(0, 3)
                          .map((l) => `${l.itemName} x${l.qty}`)
                          .join(" • ")}
                        {s.lines.length > 3 ? <span> • +{s.lines.length - 3} til</span> : null}
                      </>
                    ) : (
                      <span>Ingen varelinjer.</span>
                    )}
                  </div>

                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    Status: <b>{s.paid ? "Betalt" : "Ubetalt"}</b> • Innbetalt: <b>{fmtKr(paidSum)}</b> • Utestående:{" "}
                    <b>{fmtKr(rem)}</b> • {new Date(s.createdAt).toLocaleString("nb-NO")}
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
                      {s.payments.length > 4 ? <div style={{ marginTop: 4, opacity: 0.9 }}>… +{s.payments.length - 4} til</div> : null}
                    </div>
                  ) : null}
                </div>

                <div className="itemActions">
                  {rem > 0 ? (
                    <button className="btn btnPrimary" type="button" onClick={() => openPayment(s)}>
                      Registrer innbetaling
                    </button>
                  ) : (
                    <button className="btn" type="button" disabled>
                      Ingen rest
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
              <b>{paySale.customerName || "Anonym"}</b> • Utestående: <b>{fmtKr(Math.max(0, saleRemaining(paySale)))}</b>
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
            Total: <b>{fmtKr(delSale.total)}</b>
            <br />
            <span style={{ opacity: 0.9 }}>Velg om varene skal legges tilbake på lager eller ikke.</span>
          </div>
        ) : null}
      </ChoiceModal>
    </div>
  );
}
