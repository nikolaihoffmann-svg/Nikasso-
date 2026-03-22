// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  getItems,
  payableRemaining,
  receivableRemaining,
  saleRemaining,
  setSaldo,
  useCustomers,
  usePayables,
  usePurchases,
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
  const { payables } = usePayables();
  const { purchases } = usePurchases();
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));

  const byItemId = useMemo(() => {
    const items = getItems();
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, []);

  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  function calcProfitForSale(s: any) {
    const lines = saleLinesSafe(s as Sale);
    if (lines.length > 0) {
      return lines.reduce((acc, l) => {
        const unitCost = Number.isFinite(Number(l.unitCostAtSale))
          ? Number(l.unitCostAtSale)
          : byItemId.get(l.itemId)?.cost ?? 0;
        const qty = Number(l.qty ?? 0);
        const unitPrice = Number(l.unitPrice ?? 0);
        return acc + (unitPrice - unitCost) * qty;
      }, 0);
    }

    const unitCost = Number.isFinite(Number(s.unitCostAtSale)) ? Number(s.unitCostAtSale) : byItemId.get(s.itemId)?.cost ?? 0;
    const qty = Number(s.qty ?? 0);
    const unitPrice = Number(s.unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);
    const unpaidPayablesTotal = payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0);

    const s7 = sales.filter((s) => isAfter(s.createdAt, from7));
    const s30 = sales.filter((s) => isAfter(s.createdAt, from30));
    const sm = sales.filter((s) => isAfter(s.createdAt, fromMonth));

    const sumRevenue = (list: any[]) => list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const sumProfit = (list: any[]) => list.reduce((a, b) => a + calcProfitForSale(b), 0);

    const spentTotal = purchases.reduce((a, p) => a + (Number(p.total) || 0), 0);
    const spent30 = purchases.filter((p) => isAfter(p.createdAt, from30)).reduce((a, p) => a + (Number(p.total) || 0), 0);

    // “Når alt er betalt inn” minus “det du skylder”
    const netWhenSettled = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal - unpaidPayablesTotal;

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      unpaidPayablesTotal,
      netWhenSettled,

      spentTotal,
      spent30,

      revenue7: sumRevenue(s7),
      profit7: sumProfit(s7),
      count7: s7.length,

      revenue30: sumRevenue(s30),
      profit30: sumProfit(s30),
      count30: s30.length,

      revenueM: sumRevenue(sm),
      profitM: sumProfit(sm),
      countM: sm.length,

      revenueAll: sumRevenue(sales),
      profitAll: sumProfit(sales),
      countAll: sales.length,
    };
  }, [sales, receivables, payables, purchases, saldo, from7, from30, fromMonth, byItemId]);

  const perCustomer30 = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; profit: number; unpaid: number; count: number }>();
    const list = sales.filter((s) => isAfter(s.createdAt, from30));

    for (const s of list) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name = s.customerName || (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) || "Anonym";

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
  }, [sales, customers, from30, byItemId]);

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
      <div className="cardSub">Alt samlet: penger, utestående, innkjøp og profitt.</div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          Penger
        </div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="miniRow" style={{ marginTop: 10 }}>
          <span>
            Utestående salg: <b>{fmtKr(totals.unpaidSalesTotal)}</b>
          </span>
          <span>
            Gjeld til deg: <b>{fmtKr(totals.unpaidReceivablesTotal)}</b>
          </span>
          <span>
            Du skylder: <b>{fmtKr(totals.unpaidPayablesTotal)}</b>
          </span>
        </div>

        <div className="itemMeta" style={{ marginTop: 10, opacity: 0.95 }}>
          Netto når alt er oppgjort: <b>{fmtKr(totals.netWhenSettled)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>
            Oppdater saldo
          </button>
        </div>
      </div>

      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <div className="metricTitle">Solgt (totalt)</div>
          <div className="metricValue">{fmtKr(totals.revenueAll)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Profitt (totalt)</div>
          <div className="metricValue">{fmtKr(totals.profitAll)}</div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Penger brukt (totalt)</div>
          <div className="metricValue">{fmtKr(totals.spentTotal)}</div>
        </div>
      </div>

      <div className="metricGrid" style={{ marginTop: 10 }}>
        <div className="metricCard">
          <div className="metricTitle">Siste 7 dager</div>
          <div className="metricValue">{fmtKr(totals.revenue7)}</div>
          <div className="itemMeta">Profitt: <b>{fmtKr(totals.profit7)}</b> • Salg: <b>{totals.count7}</b></div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Siste 30 dager</div>
          <div className="metricValue">{fmtKr(totals.revenue30)}</div>
          <div className="itemMeta">Profitt: <b>{fmtKr(totals.profit30)}</b> • Salg: <b>{totals.count30}</b></div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Denne måneden</div>
          <div className="metricValue">{fmtKr(totals.revenueM)}</div>
          <div className="itemMeta">Profitt: <b>{fmtKr(totals.profitM)}</b> • Salg: <b>{totals.countM}</b></div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Kunder (topp 10 – 30 dager)</div>
        <div className="cardSub">Hvem som kjøper mest + utestående.</div>
        <div className="list">
          {perCustomer30.length === 0 ? (
            <div className="item">Ingen salg siste 30 dager.</div>
          ) : (
            perCustomer30.map((c) => (
              <div key={c.name} className="item">
                <p className="itemTitle">{c.name}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> • Utestående:{" "}
                  <b>{fmtKr(c.unpaid)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={saldoOpen} title="Oppdater saldo" onClose={() => setSaldoOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div>
            <label className="label">Saldo (kr)</label>
            <input className="input" inputMode="decimal" value={saldoInput} onChange={(e) => setSaldoInput(e.target.value)} />
          </div>

          <div className="btnRow">
            <button className="btn btnPrimary" type="button" onClick={saveSaldo}>
              Lagre
            </button>
            <button className="btn" type="button" onClick={() => setSaldoOpen(false)}>
              Avbryt
            </button>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Saldo endres manuelt. Utestående/skyld oppdateres automatisk av salg/gjeld/innkjøp.
          </div>
        </div>
      </Modal>
    </div>
  );
}
