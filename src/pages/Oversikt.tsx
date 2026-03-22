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

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
}
function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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

/** Simple SVG line chart */
function LineChart(props: {
  title: string;
  subtitle?: string;
  seriesA: { name: string; values: number[] };
  seriesB?: { name: string; values: number[] };
  labels: string[];
}) {
  const w = 680;
  const h = 220;
  const pad = 26;

  const all = [...props.seriesA.values, ...(props.seriesB ? props.seriesB.values : [])];
  const max = Math.max(1, ...all);
  const min = 0;

  const n = props.labels.length;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);

  function path(vals: number[]) {
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
      .join(" ");
  }

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="cardTitle">{props.title}</div>
      {props.subtitle ? <div className="cardSub">{props.subtitle}</div> : null}

      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="220" style={{ display: "block" }}>
        {/* grid */}
        <g opacity={0.35}>
          {[0.25, 0.5, 0.75].map((p, idx) => (
            <line
              key={idx}
              x1={pad}
              x2={w - pad}
              y1={pad + (h - pad * 2) * p}
              y2={pad + (h - pad * 2) * p}
              stroke="currentColor"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* series A */}
        <path d={path(props.seriesA.values)} fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.95} />

        {/* series B (dashed) */}
        {props.seriesB ? (
          <path
            d={path(props.seriesB.values)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity={0.55}
            strokeDasharray="6 6"
          />
        ) : null}

        {/* labels (few) */}
        <g opacity={0.65} fontSize="10">
          {props.labels.map((lb, i) => {
            if (i !== 0 && i !== n - 1 && i !== Math.floor((n - 1) / 2)) return null;
            return (
              <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fill="currentColor">
                {lb}
              </text>
            );
          })}
        </g>
      </svg>

      <div className="itemMeta" style={{ marginTop: 6 }}>
        <b>{props.seriesA.name}</b>
        {props.seriesB ? (
          <>
            {" "}
            • <span style={{ opacity: 0.85 }}>{props.seriesB.name}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Simple SVG bar chart */
function BarChart(props: { title: string; subtitle?: string; values: number[]; labels: string[] }) {
  const w = 680;
  const h = 220;
  const pad = 26;
  const max = Math.max(1, ...props.values);

  const n = props.values.length;
  const bw = (w - pad * 2) / Math.max(1, n);
  const x0 = pad;

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="cardTitle">{props.title}</div>
      {props.subtitle ? <div className="cardSub">{props.subtitle}</div> : null}

      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="220" style={{ display: "block" }}>
        <g opacity={0.35}>
          {[0.25, 0.5, 0.75].map((p, idx) => (
            <line
              key={idx}
              x1={pad}
              x2={w - pad}
              y1={pad + (h - pad * 2) * p}
              y2={pad + (h - pad * 2) * p}
              stroke="currentColor"
              strokeWidth="1"
            />
          ))}
        </g>

        {props.values.map((v, i) => {
          const bh = ((h - pad * 2) * v) / max;
          const x = x0 + i * bw + bw * 0.15;
          const y = h - pad - bh;
          const wBar = bw * 0.7;
          return <rect key={i} x={x} y={y} width={wBar} height={bh} fill="currentColor" opacity={0.55} rx="4" />;
        })}

        <g opacity={0.65} fontSize="10">
          {props.labels.map((lb, i) => {
            if (i !== 0 && i !== n - 1 && i !== Math.floor((n - 1) / 2)) return null;
            const x = x0 + i * bw + bw / 2;
            return (
              <text key={i} x={x} y={h - 8} textAnchor="middle" fill="currentColor">
                {lb}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/** Donut chart for paid vs outstanding */
function Donut(props: { title: string; subtitle?: string; paid: number; outstanding: number }) {
  const total = Math.max(1, props.paid + props.outstanding);
  const p = props.paid / total;
  const r = 44;
  const c = 2 * Math.PI * r;
  const paidLen = c * p;

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="cardTitle">{props.title}</div>
      {props.subtitle ? <div className="cardSub">{props.subtitle}</div> : null}

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: "block" }}>
          <g transform="translate(60,60) rotate(-90)">
            <circle r={r} cx="0" cy="0" fill="none" stroke="currentColor" opacity={0.18} strokeWidth="12" />
            <circle
              r={r}
              cx="0"
              cy="0"
              fill="none"
              stroke="currentColor"
              opacity={0.75}
              strokeWidth="12"
              strokeDasharray={`${paidLen} ${c - paidLen}`}
              strokeLinecap="round"
            />
          </g>
          <text x="60" y="57" textAnchor="middle" fontSize="14" fill="currentColor" opacity={0.9}>
            {Math.round(p * 100)}%
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.65}>
            betalt
          </text>
        </svg>

        <div style={{ flex: 1 }}>
          <div className="itemMeta">
            Innbetalt: <b className="successText">{fmtKr(props.paid)}</b>
            <br />
            Utestående: <b className="dangerText">{fmtKr(props.outstanding)}</b>
            <br />
            Totalt: <b>{fmtKr(props.paid + props.outstanding)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Oversikt() {
  const { sales } = useSales();
  const { customers } = useCustomers();
  const { receivables } = useReceivables();
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));
  const [moreOpen, setMoreOpen] = useState(false);

  // item cost lookup
  const byItemId = useMemo(() => {
    const items = getItems();
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, []);

  function calcProfitForSale(s: Sale) {
    const lines = saleLinesSafe(s);
    return lines.reduce((acc, l) => {
      const unitCost = Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : byItemId.get(l.itemId)?.cost ?? 0;
      const qty = Number(l.qty ?? 0);
      const unitPrice = Number(l.unitPrice ?? 0);
      return acc + (unitPrice - unitCost) * qty;
    }, 0);
  }

  const fromToday = useMemo(() => startOfDay(new Date()), []);
  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  const totals = useMemo(() => {
    const unpaidSalesTotal = sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);
    const grand = Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal;

    const listToday = sales.filter((s) => isAfter(s.createdAt, fromToday));
    const list7 = sales.filter((s) => isAfter(s.createdAt, from7));
    const list30 = sales.filter((s) => isAfter(s.createdAt, from30));
    const listM = sales.filter((s) => isAfter(s.createdAt, fromMonth));
    const listAll = sales;

    const sumRevenue = (list: Sale[]) => list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const sumProfit = (list: Sale[]) => list.reduce((a, b) => a + calcProfitForSale(b), 0);

    return {
      unpaidSalesTotal,
      unpaidReceivablesTotal,
      grand,

      todayRevenue: sumRevenue(listToday),
      todayProfit: sumProfit(listToday),
      todayCount: listToday.length,

      revenue7: sumRevenue(list7),
      profit7: sumProfit(list7),
      count7: list7.length,

      revenue30: sumRevenue(list30),
      profit30: sumProfit(list30),
      count30: list30.length,

      revenueM: sumRevenue(listM),
      profitM: sumProfit(listM),
      countM: listM.length,

      revenueAll: sumRevenue(listAll),
      profitAll: sumProfit(listAll),
      countAll: listAll.length,
    };
  }, [sales, receivables, saldo, fromToday, from7, from30, fromMonth, byItemId]);

  // Payments vs outstanding for donut (sales + receivables)
  const cashflow = useMemo(() => {
    // Paid is what has actually been paid in (payments arrays) – for sales, use salePaidSum pattern:
    let paidSales = 0;
    let outstandingSales = 0;

    for (const s of sales) {
      // paidSum = (payments sum) OR total if marked paid without payments
      const payments = Array.isArray((s as any).payments) ? (s as any).payments : [];
      const sum = payments.reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0);
      const paid = payments.length ? sum : s.paid ? Number(s.total) || 0 : 0;
      paidSales += paid;
      outstandingSales += Math.max(0, saleRemaining(s));
    }

    let paidReceivables = 0;
    let outstandingReceivables = 0;
    for (const r of receivables) {
      const payments = Array.isArray((r as any).payments) ? (r as any).payments : [];
      const sum = payments.reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0);
      const paid = payments.length ? sum : r.paid ? Number(r.amount) || 0 : 0;
      paidReceivables += paid;
      outstandingReceivables += Math.max(0, receivableRemaining(r));
    }

    return {
      paid: paidSales + paidReceivables,
      outstanding: outstandingSales + outstandingReceivables,
      paidSales,
      outstandingSales,
      paidReceivables,
      outstandingReceivables,
    };
  }, [sales, receivables]);

  // 30 day daily series for charts
  const series30 = useMemo(() => {
    const days: Date[] = [];
    for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000));

    const revenueByDay = new Map<string, number>();
    const profitByDay = new Map<string, number>();
    const countByDay = new Map<string, number>();

    for (const d of days) {
      const k = yyyyMmDd(d);
      revenueByDay.set(k, 0);
      profitByDay.set(k, 0);
      countByDay.set(k, 0);
    }

    for (const s of sales) {
      if (!isAfter(s.createdAt, from30)) continue;
      const d = new Date(s.createdAt);
      const k = yyyyMmDd(startOfDay(d));
      if (!revenueByDay.has(k)) continue;

      revenueByDay.set(k, (revenueByDay.get(k) || 0) + (Number(s.total) || 0));
      profitByDay.set(k, (profitByDay.get(k) || 0) + calcProfitForSale(s));
      countByDay.set(k, (countByDay.get(k) || 0) + 1);
    }

    const labels = days.map((d) => `${d.getDate()}.${d.getMonth() + 1}`);
    const rev = days.map((d) => revenueByDay.get(yyyyMmDd(d)) || 0);
    const prof = days.map((d) => profitByDay.get(yyyyMmDd(d)) || 0);
    const cnt = days.map((d) => countByDay.get(yyyyMmDd(d)) || 0);

    return { labels, rev, prof, cnt };
  }, [sales, from30, byItemId]);

  const mostSoldAll = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; qty: number; revenue: number; profit: number }>();

    for (const s of sales) {
      const lines = saleLinesSafe(s);
      for (const l of lines) {
        const key = l.itemId || l.itemName;
        const unitCost = Number.isFinite(Number(l.unitCostAtSale)) ? Number(l.unitCostAtSale) : byItemId.get(l.itemId)?.cost ?? 0;

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
    setSaldo(toNum(saldoInput));
    setSaldoOpen(false);
  }

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Dashboard – tall & trender.</div>

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
            Vis mer statistikk
          </button>
        </div>
      </div>

      {/* Quick KPI cards (compact) */}
      <div className="metricGrid" style={{ marginTop: 12 }}>
        <div className="metricCard">
          <p className="metricTitle">I dag</p>
          <p className="metricValue">
            {fmtKr(totals.todayRevenue)} • <span className="successText">{fmtKr(totals.todayProfit)}</span> • {totals.todayCount}
          </p>
        </div>
        <div className="metricCard">
          <p className="metricTitle">Siste 7 dager</p>
          <p className="metricValue">
            {fmtKr(totals.revenue7)} • <span className="successText">{fmtKr(totals.profit7)}</span> • {totals.count7}
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
        </div>
      </Modal>

      <Modal open={moreOpen} title="Statistikk" onClose={() => setMoreOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <Donut
            title="Betalt vs utestående"
            subtitle="Basert på registrerte innbetalinger + utestående på salg/gjeld."
            paid={cashflow.paid}
            outstanding={cashflow.outstanding}
          />

          <LineChart
            title="Omsetning & profitt (30 dager)"
            subtitle="Hel trend – uten ekstra bibliotek."
            labels={series30.labels}
            seriesA={{ name: "Omsetning", values: series30.rev }}
            seriesB={{ name: "Profitt", values: series30.prof }}
          />

          <BarChart
            title="Salg per dag (30 dager)"
            subtitle="Antall salg per dag."
            labels={series30.labels}
            values={series30.cnt}
          />

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Bestselgere (ALT)</div>
            <div className="cardSub">Topp 5 basert på antall solgte enheter.</div>
            <div className="list">
              {mostSoldAll.length === 0 ? (
                <div className="item">Ingen salg registrert enda.</div>
              ) : (
                mostSoldAll.map((x) => (
                  <div key={x.itemId || x.name} className="item">
                    <p className="itemTitle">{x.name}</p>
                    <div className="itemMeta">
                      Antall: <b>{x.qty}</b> • Solgt: <b>{fmtKr(x.revenue)}</b> • Profitt:{" "}
                      <b className="successText">{fmtKr(x.profit)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Topp kunder (ALT)</div>
            <div className="cardSub">Topp 10 basert på omsetning.</div>
            <div className="list">
              {perCustomerAll.length === 0 ? (
                <div className="item">Ingen salg registrert enda.</div>
              ) : (
                perCustomerAll.map((c) => (
                  <div key={c.name} className="item">
                    <p className="itemTitle">{c.name}</p>
                    <div className="itemMeta">
                      Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b className="successText">{fmtKr(c.profit)}</b> • Salg:{" "}
                      <b>{c.count}</b> • Utestående:{" "}
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
