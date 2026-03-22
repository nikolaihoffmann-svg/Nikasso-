// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  getItems,
  receivableRemaining,
  saleRemaining,
  setSaldo,
  useCustomers,
  useReceivables,
  useSales,
  useSaldo,
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

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function saleLinesSafe(s: Sale): SaleLine[] {
  const lines = Array.isArray((s as any).lines) ? ((s as any).lines as SaleLine[]) : [];
  if (lines.length > 0) return lines;

  // legacy fallback
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

export function Oversikt() {
  const { sales } = useSales();
  const { customers } = useCustomers();
  const { receivables } = useReceivables();
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));

  const [detailsOpen, setDetailsOpen] = useState(false);

  const byItemId = useMemo(() => {
    const items = getItems();
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, []);

  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  function calcProfitForSale(s: Sale) {
    const lines = saleLinesSafe(s);
    return lines.reduce((acc, l) => {
      const unitCost = Number.isFinite(Number(l.unitCostAtSale))
        ? Number(l.unitCostAtSale)
        : byItemId.get(l.itemId)?.cost ?? 0;
      const qty = Number(l.qty ?? 0);
      const unitPrice = Number(l.unitPrice ?? 0);
      return acc + (unitPrice - unitCost) * qty;
    }, 0);
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);
    const grand = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal;

    const s7 = sales.filter((s) => isAfter(s.createdAt, from7));
    const s30 = sales.filter((s) => isAfter(s.createdAt, from30));
    const sm = sales.filter((s) => isAfter(s.createdAt, fromMonth));
    const sall = sales;

    const sumRevenue = (list: Sale[]) => list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const sumProfit = (list: Sale[]) => list.reduce((a, b) => a + calcProfitForSale(b), 0);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      grand,

      revenue7: sumRevenue(s7),
      profit7: sumProfit(s7),
      count7: s7.length,

      revenue30: sumRevenue(s30),
      profit30: sumProfit(s30),
      count30: s30.length,

      revenueM: sumRevenue(sm),
      profitM: sumProfit(sm),
      countM: sm.length,

      revenueAll: sumRevenue(sall),
      profitAll: sumProfit(sall),
      countAll: sall.length,
    };
  }, [sales, receivables, saldo, from7, from30, fromMonth, byItemId]);

  const mostSoldAll = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; qty: number; revenue: number; profit: number }>();
    for (const s of sales) {
      const lines = saleLinesSafe(s);
      for (const l of lines) {
        const key = l.itemId || l.itemName;
        const unitCost = Number.isFinite(Number(l.unitCostAtSale))
          ? Number(l.unitCostAtSale)
          : byItemId.get(l.itemId)?.cost ?? 0;

        const prev = map.get(key) || { itemId: String(l.itemId), name: String(l.itemName), qty: 0, revenue: 0, profit: 0 };
        const qty = Number(l.qty) || 0;
        const rev = (Number(l.unitPrice) || 0) * qty;
        const prof = ((Number(l.unitPrice) || 0) - unitCost) * qty;

        prev.qty += qty;
        prev.revenue += rev;
        prev.profit += prof;
        map.set(key, prev);
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    return arr.slice(0, 5);
  }, [sales, byItemId]);

  const perCustomerAll = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; profit: number; unpaid: number; count: number }>();

    for (const s of sales) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName ||
        (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) ||
        "Anonym";

      const prev = map.get(key) || { name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      prev.unpaid += Math.max(0, saleRemaining(s));
      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 10);
  }, [sales, customers, byItemId]);

  function openSaldoModal() {
    setSaldoInput(String(saldo));
    setSaldoOpen(true);
  }

  function saveSaldo() {
    const v = toNum(saldoInput);
    setSaldo(v);
    setSaldoOpen(false);
  }

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Kort dashboard. Detaljer ligger under “Vis mer”.</div>

      {/* Penger (kort og tydelig) */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>Penger</div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="miniRow" style={{ marginTop: 8 }}>
          <span>Utestående salg: <b className="dangerText">{fmtKr(totals.unpaidSalesTotal)}</b></span>
          <span>Gjeld til deg: <b className="dangerText">{fmtKr(totals.unpaidReceivablesTotal)}</b></span>
          <span>Total når alt er betalt: <b>{fmtKr(totals.grand)}</b></span>
        </div>

        <div className="btnRow" style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>Oppdater saldo</button>
          <button className="btn" type="button" onClick={() => setDetailsOpen(true)}>Vis mer</button>
        </div>
      </div>

      {/* Tre kompakte perioder */}
      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <p className="metricTitle">Siste 7 dager</p>
          <p className="metricValue">{fmtKr(totals.revenue7)}</p>
          <div className="miniRow">
            <span>Profitt: <b>{fmtKr(totals.profit7)}</b></span>
            <span>Salg: <b>{totals.count7}</b></span>
          </div>
        </div>

        <div className="metricCard">
          <p className="metricTitle">Siste 30 dager</p>
          <p className="metricValue">{fmtKr(totals.revenue30)}</p>
          <div className="miniRow">
            <span>Profitt: <b>{fmtKr(totals.profit30)}</b></span>
            <span>Salg: <b>{totals.count30}</b></span>
          </div>
        </div>

        <div className="metricCard">
          <p className="metricTitle">All-time</p>
          <p className="metricValue">{fmtKr(totals.revenueAll)}</p>
          <div className="miniRow">
            <span>Profitt: <b>{fmtKr(totals.profitAll)}</b></span>
            <span>Salg: <b>{totals.countAll}</b></span>
          </div>
        </div>
      </div>

      {/* DETAILS MODAL */}
      <Modal open={detailsOpen} title="Oversikt – detaljer" onClose={() => setDetailsOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Mest solgt (all-time)</div>
            <div className="cardSub">Topp 5 basert på antall solgte enheter.</div>

            <div className="list">
              {mostSoldAll.length === 0 ? (
                <div className="item">Ingen salg registrert.</div>
              ) : (
                mostSoldAll.map((x) => (
                  <div key={x.itemId || x.name} className="item">
                    <div className="itemTop">
                      <div>
                        <p className="itemTitle">{x.name}</p>
                        <div className="itemMeta">
                          Antall: <b>{x.qty}</b> • Omsetning: <b>{fmtKr(x.revenue)}</b> • Profitt: <b>{fmtKr(x.profit)}</b>
                        </div>
                      </div>
                      <span className="badge">{x.qty} stk</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Topp kunder (all-time)</div>
            <div className="cardSub">Topp 10 basert på omsetning.</div>

            <div className="list">
              {perCustomerAll.length === 0 ? (
                <div className="item">Ingen salg registrert.</div>
              ) : (
                perCustomerAll.map((c) => (
                  <div key={c.name} className="item">
                    <p className="itemTitle">{c.name}</p>
                    <div className="itemMeta">
                      Omsetning: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b>{" "}
                      • Utestående: <b className={c.unpaid > 0 ? "dangerText" : "successText"}>{fmtKr(c.unpaid)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setDetailsOpen(false)}>Lukk</button>
          </div>
        </div>
      </Modal>

      <Modal open={saldoOpen} title="Oppdater saldo" onClose={() => setSaldoOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div>
            <label className="label">Saldo (kr)</label>
            <input
              className="input"
              inputMode="decimal"
              value={saldoInput}
              onChange={(e) => setSaldoInput(e.target.value)}
            />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={saveSaldo}>Lagre</button>
            <button className="btn" type="button" onClick={() => setSaldoOpen(false)}>Avbryt</button>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Tips: Saldo endres manuelt. Utestående oppdateres automatisk av salg/gjeld og innbetalinger.
          </div>
        </div>
      </Modal>
    </div>
  );
}
