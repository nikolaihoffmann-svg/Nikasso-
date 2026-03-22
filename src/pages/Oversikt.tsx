// src/pages/Oversikt.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

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

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInst = useRef<Chart | null>(null);

  const byItemId = useMemo(() => {
    const items = getItems();
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, []);

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

    const revenueAll = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
    const profitAll = sales.reduce((a, s) => a + calcProfitForSale(s), 0);
    const spentAll = purchases.reduce((a, p) => a + (Number(p.total) || 0), 0);

    const netWhenSettled = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal - unpaidPayablesTotal;

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      unpaidPayablesTotal,
      netWhenSettled,

      revenueAll,
      profitAll,
      spentAll,
    };
  }, [sales, receivables, payables, purchases, saldo, byItemId]);

  const chartData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }

    const revBy = new Map<string, number>();
    const profitBy = new Map<string, number>();
    const spentBy = new Map<string, number>();
    for (const m of months) {
      revBy.set(m, 0);
      profitBy.set(m, 0);
      spentBy.set(m, 0);
    }

    for (const s of sales) {
      const d = new Date(s.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const k = monthKey(d);
      if (!revBy.has(k)) continue;
      revBy.set(k, (revBy.get(k) || 0) + (Number(s.total) || 0));
      profitBy.set(k, (profitBy.get(k) || 0) + calcProfitForSale(s));
    }

    for (const p of purchases) {
      const d = new Date(p.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const k = monthKey(d);
      if (!spentBy.has(k)) continue;
      spentBy.set(k, (spentBy.get(k) || 0) + (Number(p.total) || 0));
    }

    const labels = months.map((m) => {
      const [y, mm] = m.split("-");
      return `${mm}.${y.slice(2)}`;
    });

    return {
      labels,
      revenue: months.map((m) => Math.round((revBy.get(m) || 0) * 100) / 100),
      spent: months.map((m) => Math.round((spentBy.get(m) || 0) * 100) / 100),
      profit: months.map((m) => Math.round((profitBy.get(m) || 0) * 100) / 100),
    };
  }, [sales, purchases, byItemId]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    chartInst.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: chartData.labels,
        datasets: [
          { label: "Solgt", data: chartData.revenue, tension: 0.25, borderWidth: 2, pointRadius: 2 },
          { label: "Brukt", data: chartData.spent, tension: 0.25, borderWidth: 2, pointRadius: 2 },
          { label: "Profitt", data: chartData.profit, tension: 0.25, borderWidth: 2, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${fmtKr(Number(c.parsed.y) || 0)}`,
            },
          },
        },
        scales: {
          y: {
            border: { display: false }, // ✅ erstatter grid.drawBorder (som ikke finnes)
            grid: { display: true },
            ticks: {
              callback: (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return String(v);
                if (Math.abs(n) >= 1000000) return `${Math.round(n / 100000) / 10}M`;
                if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
                return `${Math.round(n)}`;
              },
            },
          },
          x: {
            border: { display: false },
            grid: { display: false },
          },
        },
      },
    });

    return () => {
      if (chartInst.current) {
        chartInst.current.destroy();
        chartInst.current = null;
      }
    };
  }, [chartData]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; profit: number; count: number }>();
    for (const s of sales) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName ||
        (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) ||
        "Anonym";
      const prev = map.get(key) || { name, revenue: 0, profit: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      map.set(key, prev);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 5);
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
      <div className="cardSub">Totalt + rapport (solgt vs brukt vs profitt).</div>

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

        <div className="itemMeta" style={{ marginTop: 10 }}>
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
          <div className="metricValue">{fmtKr(totals.spentAll)}</div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Rapport</div>
        <div className="cardSub">Siste 6 måneder: solgt vs brukt vs profitt.</div>
        <div style={{ height: 280 }}>
          <canvas ref={chartRef} />
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Topp kunder (totalt)</div>
        <div className="cardSub">De 5 med mest omsetning.</div>
        <div className="list">
          {topCustomers.map((c) => (
            <div key={c.name} className="item">
              <p className="itemTitle">{c.name}</p>
              <div className="itemMeta">
                Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b>
              </div>
            </div>
          ))}
          {topCustomers.length === 0 ? <div className="item">Ingen salg registrert enda.</div> : null}
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
        </div>
      </Modal>
    </div>
  );
}
