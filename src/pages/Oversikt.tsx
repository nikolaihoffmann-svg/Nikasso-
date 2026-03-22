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

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseDateOnly(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysUntil(dueDate?: string) {
  const d = parseDateOnly(dueDate);
  if (!d) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function dueLabel(dueDate?: string) {
  const n = daysUntil(dueDate);
  if (n === null) return null;
  if (n < 0) return { kind: "overdue" as const, text: `Forfalt (${Math.abs(n)}d)` };
  if (n === 0) return { kind: "soon" as const, text: "Forfaller i dag" };
  if (n <= 7) return { kind: "soon" as const, text: `Forfaller om ${n}d` };
  return { kind: "ok" as const, text: `Forfaller om ${n}d` };
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

  // Varsler leverandør (du skylder)
  const alerts = useMemo(() => {
    const list = payables
      .map((p) => ({ p, remain: Math.max(0, payableRemaining(p)), label: dueLabel(p.dueDate) }))
      .filter((x) => x.remain > 0)
      .sort((a, b) => {
        const ad = parseDateOnly(a.p.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const bd = parseDateOnly(b.p.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });

    const overdue = list.filter((x) => x.label?.kind === "overdue").slice(0, 5);
    const soon = list.filter((x) => x.label?.kind === "soon").slice(0, 5);

    return { overdue, soon };
  }, [payables]);

  // Topp solgt (totalt, ikke bare 30 dager)
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

  // Chart data (last 6 months): revenue vs spent + profit
  const chartData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }

    const revBy = new Map<string, number>();
    const profitBy = new Map<string, number>();
    for (const m of months) {
      revBy.set(m, 0);
      profitBy.set(m, 0);
    }

    for (const s of sales) {
      const d = new Date(s.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const k = monthKey(d);
      if (!revBy.has(k)) continue;
      revBy.set(k, (revBy.get(k) || 0) + (Number(s.total) || 0));
      profitBy.set(k, (profitBy.get(k) || 0) + calcProfitForSale(s));
    }

    const spentBy = new Map<string, number>();
    for (const m of months) spentBy.set(m, 0);

    for (const p of purchases) {
      const d = new Date(p.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const k = monthKey(d);
      if (!spentBy.has(k)) continue;
      spentBy.set(k, (spentBy.get(k) || 0) + (Number(p.total) || 0));
    }

    const labels = months.map((m) => {
      const [y, mm] = m.split("-");
      return `${mm}.${y.slice(2)}`; // 03.26
    });

    return {
      labels,
      revenue: months.map((m) => Math.round((revBy.get(m) || 0) * 100) / 100),
      spent: months.map((m) => Math.round((spentBy.get(m) || 0) * 100) / 100),
      profit: months.map((m) => Math.round((profitBy.get(m) || 0) * 100) / 100),
    };
  }, [sales, purchases, byItemId]);

  // Render chart
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    // destroy old
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
          {
            label: "Solgt",
            data: chartData.revenue,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: "Brukt",
            data: chartData.spent,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: "Profitt",
            data: chartData.profit,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 2,
          },
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
            ticks: {
              callback: (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return String(v);
                // short format
                if (Math.abs(n) >= 1000000) return `${Math.round(n / 100000) / 10}M`;
                if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
                return `${Math.round(n)}`;
              },
            },
            grid: { drawBorder: false },
          },
          x: {
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

  // Top customers (total)
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
      <div className="cardSub">Mer statistikk + rapport + varsler.</div>

      {/* Penger */}
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

      {/* Varsler */}
      <div className="card">
        <div className="cardTitle">Varsler</div>
        <div className="cardSub">Leverandørgjeld (du skylder) – forfalt + forfaller snart.</div>

        <div className="list">
          {alerts.overdue.length === 0 && alerts.soon.length === 0 ? (
            <div className="item">
              <div className="itemMeta">Ingen forfalte / kommende betalinger 🎉</div>
            </div>
          ) : null}

          {alerts.overdue.map(({ p, remain, label }) => (
            <div key={p.id} className="item low">
              <p className="itemTitle">{p.supplierName}</p>
              <div className="itemMeta">
                <span className="badge danger">{label?.text ?? "Forfalt"}</span>{" "}
                <span className="badge warn">Gjenstår: {fmtKr(remain)}</span>
                {p.dueDate ? <> • Forfall: <b>{p.dueDate}</b></> : null}
              </div>
            </div>
          ))}

          {alerts.soon.map(({ p, remain, label }) => (
            <div key={p.id} className="item">
              <p className="itemTitle">{p.supplierName}</p>
              <div className="itemMeta">
                <span className="badge warn">{label?.text ?? "Forfaller snart"}</span>{" "}
                <span className="badge warn">Gjenstår: {fmtKr(remain)}</span>
                {p.dueDate ? <> • Forfall: <b>{p.dueDate}</b></> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI */}
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
          <div className="itemMeta">
            Profitt: <b>{fmtKr(totals.profit7)}</b> • Salg: <b>{totals.count7}</b>
          </div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Siste 30 dager</div>
          <div className="metricValue">{fmtKr(totals.revenue30)}</div>
          <div className="itemMeta">
            Profitt: <b>{fmtKr(totals.profit30)}</b> • Salg: <b>{totals.count30}</b>
          </div>
        </div>
        <div className="metricCard">
          <div className="metricTitle">Denne måneden</div>
          <div className="metricValue">{fmtKr(totals.revenueM)}</div>
          <div className="itemMeta">
            Profitt: <b>{fmtKr(totals.profitM)}</b> • Salg: <b>{totals.countM}</b>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="cardTitle">Rapport</div>
        <div className="cardSub">Siste 6 måneder: solgt vs brukt vs profitt.</div>

        <div style={{ height: 280 }}>
          <canvas ref={chartRef} />
        </div>
      </div>

      {/* Mest solgt (totalt) */}
      <div className="card">
        <div className="cardTitle">Mest solgt (totalt)</div>
        <div className="cardSub">Topp 5 basert på antall enheter (med omsetning/profitt).</div>

        <div className="list">
          {mostSoldAll.length === 0 ? (
            <div className="item">Ingen salg registrert enda.</div>
          ) : (
            mostSoldAll.map((x) => (
              <div key={x.itemId || x.name} className="item">
                <p className="itemTitle">{x.name}</p>
                <div className="itemMeta">
                  Antall: <b>{x.qty}</b> • Solgt: <b>{fmtKr(x.revenue)}</b> • Profitt: <b>{fmtKr(x.profit)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Kunder (totalt) */}
      <div className="card">
        <div className="cardTitle">Kunder (topp 10 totalt)</div>
        <div className="cardSub">Solgt/profitt/utestående per kunde, totalt.</div>

        <div className="list">
          {perCustomerAll.length === 0 ? (
            <div className="item">Ingen salg registrert enda.</div>
          ) : (
            perCustomerAll.map((c) => (
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
