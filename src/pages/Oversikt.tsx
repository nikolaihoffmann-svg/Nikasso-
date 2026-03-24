// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  getItems,
  getPurchaseTotalsByKind,
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
  round2,
} from "../app/storage";

/* =========================
   Helpers
========================= */

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(ym: string) {
  // "2026-03" -> "03.26"
  const [y, m] = ym.split("-");
  return `${m}.${String(y).slice(2)}`;
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
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

/* =========================
   Lightweight SVG charts
   (no libs -> no build pain)
========================= */

function LineChart(props: {
  title: string;
  subtitle?: string;
  series: { name: string; values: number[] }[];
  labels: string[];
}) {
  const W = 640;
  const H = 220;
  const pad = 26;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const all = props.series.flatMap((s) => s.values);
  const max = Math.max(1, ...all.map((v) => (Number.isFinite(v) ? v : 0)));

  const x = (i: number) => pad + (props.labels.length <= 1 ? 0 : (i / (props.labels.length - 1)) * innerW);
  const y = (v: number) => pad + innerH - clamp01(v / max) * innerH;

  const gridLines = 4;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => i);

  // Calm, consistent colors
  const palette = [
    "rgba(79,131,255,0.95)",  // blue
    "rgba(53,208,127,0.92)",  // green
    "rgba(255,204,102,0.90)", // amber
    "rgba(255,90,95,0.88)",   // red
  ];

  return (
    <div className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="cardSub">{props.subtitle ?? `Siste ${props.labels.length} måneder`}</div>

      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title} style={{ display: "block" }}>
          {/* grid */}
          {grid.map((g) => {
            const yy = pad + (g / gridLines) * innerH;
            return <line key={g} x1={pad} y1={yy} x2={W - pad} y2={yy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
          })}

          {/* series */}
          {props.series.map((s, si) => {
            const stroke = palette[si % palette.length];
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <g key={s.name}>
                <polyline fill="none" stroke={stroke} strokeWidth="3" points={pts} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={stroke} />
                ))}
              </g>
            );
          })}

          {/* x labels (sparse) */}
          {props.labels.map((lab, i) => {
            const show = props.labels.length <= 6 ? true : i === 0 || i === props.labels.length - 1 || i % 2 === 1;
            if (!show) return null;
            return (
              <text key={lab} x={x(i)} y={H - 8} fill="rgba(255,255,255,0.55)" fontSize="12" textAnchor="middle">
                {lab}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="miniRow" style={{ marginTop: 8 }}>
        {props.series.map((s, i) => (
          <span key={s.name} className="badge" style={{ opacity: 0.95 }}>
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart(props: { title: string; values: { label: string; value: number; meta?: string }[] }) {
  const max = Math.max(1, ...props.values.map((x) => (Number.isFinite(x.value) ? x.value : 0)));
  return (
    <div className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="cardSub">Topp {props.values.length}</div>

      <div className="list">
        {props.values.map((x) => {
          const w = `${Math.round((x.value / max) * 100)}%`;
          return (
            <div key={x.label} className="item" style={{ padding: 10 }}>
              <div className="itemTop" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.label}</div>
                  <div className="itemMeta">
                    {fmtKr(x.value)}
                    {x.meta ? <span style={{ marginLeft: 8, opacity: 0.9 }}>• {x.meta}</span> : null}
                  </div>
                </div>
                <div style={{ width: 140 }}>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: w, height: "100%", background: "rgba(79,131,255,0.85)" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   Modal
========================= */

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

/* =========================
   Page
========================= */

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

    // legacy fallback
    const unitCost =
      Number.isFinite(Number((s as any).unitCostAtSale)) ? Number((s as any).unitCostAtSale) : byItemId.get((s as any).itemId)?.cost ?? 0;
    const qty = Number((s as any).qty ?? 0);
    const unitPrice = Number((s as any).unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
    const unpaidReceivablesTotal = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));

    const totalRevenue = round2(sales.reduce((a, s) => a + (Number(s.total) || 0), 0));
    const totalProfit = round2(sales.reduce((a, s) => a + calcProfitForSale(s), 0));

    const avgSale = sales.length ? round2(totalRevenue / sales.length) : 0;
    const margin = totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : 0;

    // Purchases split
    const purchaseSplit = getPurchaseTotalsByKind(purchases);

    // "Du skylder" = utestående leverandørgjeld (payables)
    const youOweTotal = round2(payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0));

    // Netto når alt er oppgjort:
    // saldo + (utestående inn) - (du skylder)
    const netWhenSettled = round2(Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal - youOweTotal);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      youOweTotal,
      netWhenSettled,

      totalRevenue,
      totalProfit,
      avgSale,
      margin,

      purchaseSplit,
    };
  }, [sales, receivables, payables, purchases, saldo, byItemId]);

  const months = useMemo(() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(yyyymm(d));
    }
    return list;
  }, []);

  const monthlySalesSeries = useMemo(() => {
    const rev = new Map<string, number>();
    const prof = new Map<string, number>();

    for (const ym of months) {
      rev.set(ym, 0);
      prof.set(ym, 0);
    }

    for (const s of sales) {
      const d = new Date(s.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const key = yyyymm(d);
      if (!rev.has(key)) continue;

      rev.set(key, (rev.get(key) ?? 0) + (Number(s.total) || 0));
      prof.set(key, (prof.get(key) ?? 0) + calcProfitForSale(s));
    }

    const labels = months.map(monthLabel);
    return {
      labels,
      revenue: months.map((m) => round2(rev.get(m) ?? 0)),
      profit: months.map((m) => round2(prof.get(m) ?? 0)),
    };
  }, [months, sales, byItemId]);

  const monthlyPurchaseSeries = useMemo(() => {
    const items = new Map<string, number>();
    const cons = new Map<string, number>();
    const equip = new Map<string, number>();

    for (const ym of months) {
      items.set(ym, 0);
      cons.set(ym, 0);
      equip.set(ym, 0);
    }

    for (const p of purchases) {
      const d = new Date(p.createdAt || "");
      if (!Number.isFinite(d.getTime())) continue;
      const key = yyyymm(d);
      if (!items.has(key)) continue;

      for (const l of p.lines || []) {
        const sum = round2((Number(l.qty) || 0) * (Number(l.unitCost) || 0));
        if (l.kind === "consumable") cons.set(key, (cons.get(key) ?? 0) + sum);
        else if (l.kind === "equipment") equip.set(key, (equip.get(key) ?? 0) + sum);
        else items.set(key, (items.get(key) ?? 0) + sum);
      }
    }

    const labels = months.map(monthLabel);
    return {
      labels,
      items: months.map((m) => round2(items.get(m) ?? 0)),
      consumables: months.map((m) => round2(cons.get(m) ?? 0)),
      equipment: months.map((m) => round2(equip.get(m) ?? 0)),
    };
  }, [months, purchases]);

  const topCustomersAllTime = useMemo(() => {
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

  const topItemsAllTime = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    for (const s of sales) {
      const lines = saleLinesSafe(s);
      for (const l of lines) {
        const key = l.itemId || l.itemName;
        const unitCost = Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : byItemId.get(l.itemId)?.cost ?? 0;

        const prev = map.get(key) || { name: String(l.itemName), qty: 0, revenue: 0, profit: 0 };
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
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 5);
  }, [sales, byItemId]);

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
      <div className="cardSub">Totalt + rapport (solgt vs innkjøp vs profitt).</div>

      {/* Penger */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          Penger
        </div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Utestående salg: <b>{fmtKr(totals.unpaidSalesTotal)}</b>
          {" • "}
          Gjeld til deg: <b>{fmtKr(totals.unpaidReceivablesTotal)}</b>
          {" • "}
          Du skylder: <b className={totals.youOweTotal > 0 ? "dangerText" : ""}>{fmtKr(totals.youOweTotal)}</b>
        </div>

        <div className="itemMeta" style={{ marginTop: 8 }}>
          Netto når alt er oppgjort: <b>{fmtKr(totals.netWhenSettled)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>
            Oppdater saldo
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <p className="metricTitle">Solgt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.totalRevenue)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Profitt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.totalProfit)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Margin (totalt)</p>
          <p className="metricValue">{totals.margin.toFixed(1)}%</p>
        </div>

        <div className="metricCard">
          <p className="metricTitle">Snitt pr salg</p>
          <p className="metricValue">{fmtKr(totals.avgSale)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Salg (antall)</p>
          <p className="metricValue">{sales.length}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Innkjøp (totalt)</p>
          <p className="metricValue">{fmtKr(totals.purchaseSplit.grandTotal)}</p>
        </div>
      </div>

      {/* Innkjøp split KPI */}
      <div className="metricGrid" style={{ marginTop: 10 }}>
        <div className="metricCard">
          <p className="metricTitle">Varekjøp (totalt)</p>
          <p className="metricValue">{fmtKr(totals.purchaseSplit.itemsTotal)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Forbruk (totalt)</p>
          <p className="metricValue">{fmtKr(totals.purchaseSplit.consumablesTotal)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Utstyr (totalt)</p>
          <p className="metricValue">{fmtKr(totals.purchaseSplit.equipmentTotal)}</p>
        </div>
      </div>

      {/* Grafer */}
      <LineChart
        title="Solgt vs profitt"
        labels={monthlySalesSeries.labels}
        series={[
          { name: "Solgt", values: monthlySalesSeries.revenue },
          { name: "Profitt", values: monthlySalesSeries.profit },
        ]}
      />

      <LineChart
        title="Innkjøp (12 mnd)"
        subtitle="Varekjøp vs forbruk vs utstyr"
        labels={monthlyPurchaseSeries.labels}
        series={[
          { name: "Varekjøp", values: monthlyPurchaseSeries.items },
          { name: "Forbruk", values: monthlyPurchaseSeries.consumables },
          { name: "Utstyr", values: monthlyPurchaseSeries.equipment },
        ]}
      />

      {/* Topplister */}
      <BarChart
        title="Topp kunder (totalt)"
        values={topCustomersAllTime.map((c) => ({
          label: c.name,
          value: round2(c.revenue),
          meta: `${c.count} salg`,
        }))}
      />

      <BarChart
        title="Topp varer (totalt)"
        values={topItemsAllTime.map((x) => ({
          label: x.name,
          value: round2(x.revenue),
          meta: `${x.qty} stk`,
        }))}
      />

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
            Tips: Saldo endres bare manuelt. Utestående oppdateres automatisk av salg/gjeld/innkjøp og innbetalinger.
          </div>
        </div>
      </Modal>
    </div>
  );
}
