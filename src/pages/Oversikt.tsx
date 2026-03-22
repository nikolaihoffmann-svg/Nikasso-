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

/* =========================
   Helpers
========================= */

function toNum(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
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

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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

/* =========================
   Lightweight SVG charts
========================= */

function LineChart(props: {
  title: string;
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

  return (
    <div className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="cardSub">Siste {props.labels.length} måneder</div>

      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title} style={{ display: "block" }}>
          {/* grid */}
          {grid.map((g) => {
            const yy = pad + (g / gridLines) * innerH;
            return <line key={g} x1={pad} y1={yy} x2={W - pad} y2={yy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
          })}

          {/* series */}
          {props.series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            const stroke = si === 0 ? "rgba(79,131,255,0.95)" : si === 1 ? "rgba(255,90,95,0.85)" : "rgba(53,208,127,0.9)";
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
        {props.series.map((s) => (
          <span key={s.name} className="badge" style={{ opacity: 0.95 }}>
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart(props: { title: string; values: { label: string; value: number }[]; suffix?: string }) {
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
                  <div className="itemMeta">{fmtKr(x.value)}{props.suffix ? ` ${props.suffix}` : ""}</div>
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
   Purchases (Innkjøp) reader (robust)
   - Leser fra localStorage hvis du har innkjøp der allerede.
   - Hvis ikke: blir 0.
========================= */

type AnyPurchase = {
  id?: string;
  total?: number; // brukt/innkjøp total
  amount?: number;
  paid?: boolean;
  payments?: { amount: number }[];
  createdAt?: string;
};

function getPurchasesLocal(): AnyPurchase[] {
  const keys = ["sg.purchases.v1", "sg.innkjop.v1", "sg.purchases", "sg.innkjop"];
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.purchases)) return parsed.purchases;
      if (Array.isArray(parsed?.innkjop)) return parsed.innkjop;
    } catch {
      // ignore
    }
  }
  return [];
}

function purchasePaidSum(p: AnyPurchase) {
  if (Array.isArray(p.payments) && p.payments.length) {
    return round2(p.payments.reduce((a, x) => a + (Number(x.amount) || 0), 0));
  }
  const total = Number(p.total ?? p.amount ?? 0) || 0;
  return p.paid ? round2(total) : 0;
}

function purchaseTotal(p: AnyPurchase) {
  return round2(Number(p.total ?? p.amount ?? 0) || 0);
}

function purchaseRemaining(p: AnyPurchase) {
  const t = purchaseTotal(p);
  const paid = purchasePaidSum(p);
  return round2(Math.max(0, t - paid));
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

  const purchases = useMemo(() => getPurchasesLocal(), []);

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

    const totalRevenue = round2(sales.reduce((a, s) => a + (Number(s.total) || 0), 0));
    const totalProfit = round2(sales.reduce((a, s) => a + calcProfitForSale(s), 0));

    const spentTotal = round2(purchases.reduce((a, p) => a + purchaseTotal(p), 0));
    const youOweTotal = round2(purchases.reduce((a, p) => a + purchaseRemaining(p), 0));

    const netWhenSettled = round2(Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal - youOweTotal);

    const avgSale = sales.length ? round2(totalRevenue / sales.length) : 0;
    const margin = totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : 0;

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,

      totalRevenue,
      totalProfit,
      avgSale,
      margin,

      spentTotal,
      youOweTotal,

      netWhenSettled,
    };
  }, [sales, receivables, saldo, purchases, byItemId]);

  const months = useMemo(() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(yyyymm(d));
    }
    return list;
  }, []);

  const monthlySeries = useMemo(() => {
    const rev = new Map<string, number>();
    const prof = new Map<string, number>();
    const spent = new Map<string, number>();

    for (const ym of months) {
      rev.set(ym, 0);
      prof.set(ym, 0);
      spent.set(ym, 0);
    }

    for (const s of sales) {
      const d = new Date(s.createdAt);
      if (!Number.isFinite(d.getTime())) continue;
      const key = yyyymm(d);
      if (!rev.has(key)) continue;
      rev.set(key, (rev.get(key) ?? 0) + (Number(s.total) || 0));
      prof.set(key, (prof.get(key) ?? 0) + calcProfitForSale(s));
    }

    for (const p of purchases) {
      const d = new Date(p.createdAt || "");
      if (!Number.isFinite(d.getTime())) continue;
      const key = yyyymm(d);
      if (!spent.has(key)) continue;
      spent.set(key, (spent.get(key) ?? 0) + purchaseTotal(p));
    }

    const labels = months.map(monthLabel);
    return {
      labels,
      revenue: months.map((m) => round2(rev.get(m) ?? 0)),
      profit: months.map((m) => round2(prof.get(m) ?? 0)),
      spent: months.map((m) => round2(spent.get(m) ?? 0)),
    };
  }, [months, sales, purchases, byItemId]);

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

      {/* Totalt KPI */}
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
          <p className="metricTitle">Penger brukt (totalt)</p>
          <p className="metricValue">{fmtKr(totals.spentTotal)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Snitt pr salg</p>
          <p className="metricValue">{fmtKr(totals.avgSale)}</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Margin (totalt)</p>
          <p className="metricValue">{totals.margin.toFixed(1)}%</p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Salg (antall)</p>
          <p className="metricValue">{sales.length}</p>
        </div>
      </div>

      {/* Grafer */}
      <LineChart
        title="Rapport"
        labels={monthlySeries.labels}
        series={[
          { name: "Solgt", values: monthlySeries.revenue },
          { name: "Brukt", values: monthlySeries.spent },
          { name: "Profitt", values: monthlySeries.profit },
        ]}
      />

      <LineChart
        title="Solgt vs profitt (zoom)"
        labels={monthlySeries.labels}
        series={[
          { name: "Solgt", values: monthlySeries.revenue },
          { name: "Profitt", values: monthlySeries.profit },
        ]}
      />

      {/* Topplister */}
      <BarChart
        title="Topp kunder (totalt)"
        values={topCustomersAllTime.map((c) => ({ label: c.name, value: round2(c.revenue) }))}
      />

      <BarChart
        title="Topp varer (totalt)"
        values={topItemsAllTime.map((x) => ({ label: x.name, value: round2(x.revenue) }))}
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
