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

  const [moreOpen, setMoreOpen] = useState(false);

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

    const unitCost =
      Number.isFinite(Number(s.unitCostAtSale)) ? Number(s.unitCostAtSale) : byItemId.get(s.itemId)?.cost ?? 0;
    const qty = Number(s.qty ?? 0);
    const unitPrice = Number(s.unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);
    const grand = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal;

    const s7 = sales.filter((s) => isAfter(s.createdAt, from7));
    const s30 = sales.filter((s) => isAfter(s.createdAt, from30));
    const sm = sales.filter((s) => isAfter(s.createdAt, fromMonth));
    const sall = sales; // ✅ alt siden start

    const sumRevenue = (list: any[]) => list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const sumProfit = (list: any[]) => list.reduce((a, b) => a + calcProfitForSale(b), 0);

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
    return arr.slice(0, 20);
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

      {/* Penger */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          Penger
        </div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Utestående salg: <b className="dangerText">{fmtKr(totals.unpaidSalesTotal)}</b> • Gjeld til deg:{" "}
          <b className="dangerText">{fmtKr(totals.unpaidReceivablesTotal)}</b>
        </div>

        <div className="itemMeta" style={{ marginTop: 8 }}>
          Total når alt er betalt: <b>{fmtKr(totals.grand)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>
            Oppdater saldo
          </button>
          <button className="btn" type="button" onClick={() => setMoreOpen(true)}>
            Vis mer
          </button>
        </div>
      </div>

      {/* Kompakt metrics */}
      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <p className="metricTitle">Siste 7 dager</p>
          <p className="metricValue">
            {fmtKr(totals.revenue7)} • <span className="successText">{fmtKr(totals.profit7)}</span> • {totals.count7}
          </p>
        </div>

        <div className="metricCard">
          <p className="metricTitle">Siste 30 dager</p>
          <p className="metricValue">
            {fmtKr(totals.revenue30)} • <span className="successText">{fmtKr(totals.profit30)}</span> • {totals.count30}
          </p>
        </div>

        <div className="metricCard">
          <p className="metricTitle">ALT (siden start)</p>
          <p className="metricValue">
            {fmtKr(totals.revenueAll)} • <span className="successText">{fmtKr(totals.profitAll)}</span> • {totals.countAll}
          </p>
        </div>
      </div>

      <Modal open={saldoOpen} title="Oppdater saldo" onClose={() => setSaldoOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div>
            <label className="label">Saldo (kr)</label>
            <input className="input" inputMode="decimal" value={saldoInput} onChange={(e) => setSaldoInput(e.target.value)} />
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setSaldoOpen(false)}>
              Avbryt
            </button>
            <button className="btn btnPrimary" type="button" onClick={saveSaldo}>
              Lagre
            </button>
          </div>

          <div className="itemMeta" style={{ marginTop: 6 }}>
            Tips: Saldo endres manuelt. Utestående oppdateres automatisk.
          </div>
        </div>
      </Modal>

      <Modal open={moreOpen} title="Detaljer" onClose={() => setMoreOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Denne måneden</div>
            <div className="itemMeta">
              Solgt: <b>{fmtKr(totals.revenueM)}</b> • Profitt: <b className="successText">{fmtKr(totals.profitM)}</b> • Salg: <b>{totals.countM}</b>
            </div>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Mest solgt (ALT)</div>
            <div className="cardSub">Topp 5 basert på antall solgte enheter (med omsetning/profitt).</div>

            <div className="list">
              {mostSoldAll.length === 0 ? (
                <div className="item">Ingen salg registrert enda.</div>
              ) : (
                mostSoldAll.map((x) => (
                  <div key={x.itemId || x.name} className="item">
                    <p className="itemTitle">{x.name}</p>
                    <div className="itemMeta">
                      Antall: <b>{x.qty}</b> • Solgt: <b>{fmtKr(x.revenue)}</b> • Profitt: <b className="successText">{fmtKr(x.profit)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Topp kunder (ALT)</div>
            <div className="cardSub">Topp 20 basert på omsetning.</div>

            <div className="list">
              {perCustomerAll.length === 0 ? (
                <div className="item">Ingen salg enda.</div>
              ) : (
                perCustomerAll.map((c) => (
                  <div key={c.name} className="item">
                    <p className="itemTitle">{c.name}</p>
                    <div className="itemMeta">
                      Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b className="successText">{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> • Utestående:{" "}
                      <b className={c.unpaid > 0 ? "dangerText" : "successText"}>{fmtKr(c.unpaid)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="btnRow" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => setMoreOpen(false)}>
              Lukk
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
