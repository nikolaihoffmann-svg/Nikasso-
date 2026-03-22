// src/pages/Oversikt.tsx
import React, { useMemo, useState } from "react";
import {
  fmtKr,
  getItems,
  getPayables,
  getPurchases,
  payableRemaining,
  receivableRemaining,
  round2,
  saleRemaining,
  setSaldo,
  useCustomers,
  useReceivables,
  useSales,
  useSaldo,
  Sale,
  SaleLine,
} from "../app/storage";

/* =========================
   Helpers
========================= */

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
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

function safeDate(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
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
   Mini SVG Charts (no libs)
========================= */

function LineChart(props: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
}) {
  const W = 680;
  const H = 240;
  const pad = 28;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const all = props.series.flatMap((s) => s.values);
  const max = Math.max(1, ...all.map((v) => (Number.isFinite(v) ? v : 0)));

  const x = (i: number) => pad + (props.labels.length <= 1 ? 0 : (i / (props.labels.length - 1)) * innerW);
  const y = (v: number) => pad + innerH - clamp01(v / max) * innerH;

  const gridLines = 4;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => i);

  return (
    <div className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="cardSub">{props.subtitle ?? ""}</div>

      <div style={{ overflowX: "auto" }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={props.title}
          style={{ display: "block" }}
        >
          {/* grid */}
          {grid.map((g) => {
            const yy = pad + (g / gridLines) * innerH;
            return (
              <line
                key={g}
                x1={pad}
                y1={yy}
                x2={W - pad}
                y2={yy}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* series */}
          {props.series.map((s) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <g key={s.name}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth="3"
                  points={pts}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r="3.4" fill={s.color} />
                ))}
              </g>
            );
          })}

          {/* x labels */}
          {props.labels.map((lab, i) => {
            const show = props.labels.length <= 6 ? true : i === 0 || i === props.labels.length - 1 || i % 2 === 1;
            if (!show) return null;
            return (
              <text
                key={`${lab}_${i}`}
                x={x(i)}
                y={H - 9}
                fill="rgba(255,255,255,0.55)"
                fontSize="12"
                textAnchor="middle"
              >
                {lab}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="miniRow" style={{ marginTop: 8 }}>
        {props.series.map((s) => (
          <span key={s.name} className="badge">
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarList(props: {
  title: string;
  subtitle?: string;
  values: { label: string; value: number; right?: string }[];
}) {
  const max = Math.max(1, ...props.values.map((x) => (Number.isFinite(x.value) ? x.value : 0)));

  return (
    <div className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="cardSub">{props.subtitle ?? ""}</div>

      <div className="list">
        {props.values.map((x) => {
          const w = `${Math.round((x.value / max) * 100)}%`;
          return (
            <div key={x.label} className="item" style={{ padding: 10 }}>
              <div className="itemTop" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {x.label}
                  </div>
                  <div className="itemMeta">
                    <b>{fmtKr(x.value)}</b>
                    {x.right ? <span style={{ opacity: 0.9 }}> • {x.right}</span> : null}
                  </div>
                </div>

                <div style={{ width: 160 }}>
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
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));

  const purchases = useMemo(() => getPurchases(), []);
  const payables = useMemo(() => getPayables(), []);

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

    const unitCost =
      Number.isFinite(Number((s as any).unitCostAtSale)) ? Number((s as any).unitCostAtSale) : byItemId.get((s as any).itemId)?.cost ?? 0;
    const qty = Number((s as any).qty ?? 0);
    const unitPrice = Number((s as any).unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const totals = useMemo(() => {
    const unpaidSalesTotal = round2(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0));
    const unpaidReceivablesTotal = round2(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0));
    const unpaidPayablesTotal = round2(payables.reduce((a, p) => a + Math.max(0, payableRemaining(p)), 0));

    const revenueTotal = round2(sales.reduce((a, s) => a + (Number(s.total) || 0), 0));
    const profitTotal = round2(sales.reduce((a, s) => a + calcProfitForSale(s), 0));
    const spentTotal = round2(purchases.reduce((a, p) => a + (Number(p.total) || 0), 0));

    const countSales = sales.length;
    const avgSale = countSales ? round2(revenueTotal / countSales) : 0;
    const marginPct = revenueTotal > 0 ? round2((profitTotal / revenueTotal) * 100) : 0;

    // "Når alt er oppgjort" = saldo + penger inn som forventes (utestående salg + gjeld til deg) - penger ut du skylder (leverandørgjeld)
    const netWhenSettled = round2(Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal - unpaidPayablesTotal);

    // cashflow-ish (for feel): solgt - brukt
    const netSalesMinusSpent = round2(revenueTotal - spentTotal);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      unpaidPayablesTotal,
      revenueTotal,
      profitTotal,
      spentTotal,
      countSales,
      avgSale,
      marginPct,
      netWhenSettled,
      netSalesMinusSpent,
    };
  }, [sales, receivables, payables, purchases, saldo, byItemId]);

  // 12 måneder vindu
  const months = useMemo(() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 11; i >= 0; i--) {
      list.push(yyyymm(addMonths(now, -i)));
    }
    return list;
  }, []);

  const monthly = useMemo(() => {
    const rev = new Map<string, number>();
    const prof = new Map<string, number>();
    const spent = new Map<string, number>();
    for (const ym of months) {
      rev.set(ym, 0);
      prof.set(ym, 0);
      spent.set(ym, 0);
    }

    for (const s of sales) {
      const d = safeDate(s.createdAt);
      if (!d) continue;
      const key = yyyymm(d);
      if (!rev.has(key)) continue;
      rev.set(key, (rev.get(key) ?? 0) + (Number(s.total) || 0));
      prof.set(key, (prof.get(key) ?? 0) + calcProfitForSale(s));
    }

    for (const p of purchases) {
      const d = safeDate(p.createdAt);
      if (!d) continue;
      const key = yyyymm(d);
      if (!spent.has(key)) continue;
      spent.set(key, (spent.get(key) ?? 0) + (Number(p.total) || 0));
    }

    const labels = months.map(monthLabel);
    const revenue = months.map((m) => round2(rev.get(m) ?? 0));
    const profit = months.map((m) => round2(prof.get(m) ?? 0));
    const used = months.map((m) => round2(spent.get(m) ?? 0));
    const net = months.map((m, i) => round2(revenue[i] - used[i]));

    return { labels, revenue, profit, used, net };
  }, [months, sales, purchases, byItemId]);

  // Kumulativ siden start (sortert eldste -> nyeste)
  const cumulative = useMemo(() => {
    const sorted = [...sales].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    const labels: string[] = [];
    const cumRevenue: number[] = [];
    const cumProfit: number[] = [];

    let r = 0;
    let p = 0;

    // lag maks 18 punkter for ikke å bli “tung”
    const step = sorted.length <= 18 ? 1 : Math.ceil(sorted.length / 18);

    for (let i = 0; i < sorted.length; i += step) {
      const s = sorted[i];
      r += Number(s.total) || 0;
      p += calcProfitForSale(s);
      const d = safeDate(s.createdAt);
      labels.push(d ? `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}` : `#${i + 1}`);
      cumRevenue.push(round2(r));
      cumProfit.push(round2(p));
    }

    if (sorted.length === 0) {
      return { labels: ["0"], cumRevenue: [0], cumProfit: [0] };
    }

    return { labels, cumRevenue, cumProfit };
  }, [sales, byItemId]);

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
      <div className="cardSub">Totalt + rapport (solgt vs brukt vs profitt).</div>

      {/* Penger */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          Penger
        </div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Utestående salg: <b className={totals.unpaidSalesTotal > 0 ? "dangerText" : ""}>{fmtKr(totals.unpaidSalesTotal)}</b>
          {" • "}
          Gjeld til deg: <b className={totals.unpaidReceivablesTotal > 0 ? "warnText" : ""}>{fmtKr(totals.unpaidReceivablesTotal)}</b>
          {" • "}
          Du skylder: <b className={totals.unpaidPayablesTotal > 0 ? "dangerText" : ""}>{fmtKr(totals.unpaidPayablesTotal)}</b>
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

      {/* KPI (totalt) */}
      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <p className="metricTitle">Solgt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.revenueTotal)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Profitt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.profitTotal)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Penger brukt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.spentTotal)}</p>
        </div>

        <div className="metricCard">
          <p className="metricTitle">Netto (solgt − brukt)</p>
          <p className="metricValue">{fmtKr(totals.netSalesMinusSpent)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Snitt pr salg</p>
          <p className="metricValue">{fmtKr(totals.avgSale)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Margin (totalt)</p>
          <p className="metricValue">{totals.marginPct.toFixed(1)}%</p>
        </div>
      </div>

      {/* Grafer */}
      <LineChart
        title="Rapport (12 mnd)"
        subtitle="Solgt vs brukt vs profitt."
        labels={monthly.labels}
        series={[
          { name: "Solgt", values: monthly.revenue, color: "rgba(79,131,255,0.95)" },
          { name: "Brukt", values: monthly.used, color: "rgba(255,90,95,0.85)" },
          { name: "Profitt", values: monthly.profit, color: "rgba(53,208,127,0.9)" },
        ]}
      />

      <LineChart
        title="Netto per måned (12 mnd)"
        subtitle="Solgt minus brukt."
        labels={monthly.labels}
        series={[
          { name: "Netto", values: monthly.net, color: "rgba(255,204,102,0.95)" },
        ]}
      />

      <LineChart
        title="Kumulativt siden start"
        subtitle="Oppsamlet omsetning og profitt (glattet til få punkter)."
        labels={cumulative.labels}
        series={[
          { name: "Omsetning", values: cumulative.cumRevenue, color: "rgba(79,131,255,0.95)" },
          { name: "Profitt", values: cumulative.cumProfit, color: "rgba(53,208,127,0.9)" },
        ]}
      />

      {/* Topplister */}
      <BarList
        title="Topp kunder (totalt)"
        subtitle="Topp 5 basert på omsetning."
        values={topCustomersAllTime.map((c) => ({
          label: c.name,
          value: round2(c.revenue),
          right: `Salg: ${c.count}`,
        }))}
      />

      <BarList
        title="Topp varer (totalt)"
        subtitle="Topp 5 basert på omsetning."
        values={topItemsAllTime.map((x) => ({
          label: x.name,
          value: round2(x.revenue),
          right: `Antall: ${x.qty}`,
        }))}
      />

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
