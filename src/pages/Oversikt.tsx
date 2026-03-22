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

type PeriodKey = "7d" | "30d" | "month" | "all";

export function Oversikt() {
  const { sales } = useSales();
  const { customers } = useCustomers();
  const { receivables } = useReceivables();
  const [saldo] = useSaldo();

  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldoInput, setSaldoInput] = useState(String(saldo));

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPeriod, setDetailsPeriod] = useState<PeriodKey>("30d");

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
      Number.isFinite(Number((s as any).unitCostAtSale))
        ? Number((s as any).unitCostAtSale)
        : byItemId.get((s as any).itemId)?.cost ?? 0;
    const qty = Number((s as any).qty ?? 0);
    const unitPrice = Number((s as any).unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const unpaidSalesTotal = useMemo(
    () => Math.round(sales.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0) * 100) / 100,
    [sales]
  );

  const unpaidReceivablesTotal = useMemo(
    () => Math.round(receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0) * 100) / 100,
    [receivables]
  );

  const grand = useMemo(
    () => Number(saldo) + unpaidSalesTotal + unpaidReceivablesTotal,
    [saldo, unpaidSalesTotal, unpaidReceivablesTotal]
  );

  function listForPeriod(p: PeriodKey) {
    if (p === "7d") return sales.filter((s) => isAfter(s.createdAt, from7));
    if (p === "30d") return sales.filter((s) => isAfter(s.createdAt, from30));
    if (p === "month") return sales.filter((s) => isAfter(s.createdAt, fromMonth));
    return sales; // all
  }

  const kpis = useMemo(() => {
    const mk = (list: Sale[]) => {
      const revenue = list.reduce((a, b) => a + (Number(b.total) || 0), 0);
      const profit = list.reduce((a, b) => a + calcProfitForSale(b), 0);
      return { revenue, profit, count: list.length };
    };

    return {
      d7: mk(listForPeriod("7d")),
      d30: mk(listForPeriod("30d")),
      month: mk(listForPeriod("month")),
      all: mk(listForPeriod("all")),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, from7, from30, fromMonth, byItemId]);

  const mostSold = useMemo(() => {
    const list = listForPeriod(detailsPeriod);
    const map = new Map<string, { itemId: string; name: string; qty: number; revenue: number; profit: number }>();

    for (const s of list) {
      for (const l of saleLinesSafe(s)) {
        const key = l.itemId || l.itemName;
        const unitCost = Number.isFinite(Number(l.unitCostAtSale))
          ? Number(l.unitCostAtSale)
          : byItemId.get(l.itemId)?.cost ?? 0;

        const prev =
          map.get(key) || { itemId: String(l.itemId), name: String(l.itemName), qty: 0, revenue: 0, profit: 0 };

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
    return arr.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, detailsPeriod, byItemId]);

  const perCustomer = useMemo(() => {
    const list = listForPeriod(detailsPeriod);
    const map = new Map<string, { id: string; name: string; revenue: number; profit: number; unpaid: number; count: number }>();

    for (const s of list) {
      const key = s.customerId ? String(s.customerId) : "anon";
      const name =
        s.customerName ||
        (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) ||
        "Anonym";

      const prev = map.get(key) || { id: key, name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      prev.unpaid += Math.max(0, saleRemaining(s));
      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, customers, detailsPeriod, byItemId]);

  function openSaldoModal() {
    setSaldoInput(String(saldo));
    setSaldoOpen(true);
  }

  function saveSaldo() {
    const v = toNum(saldoInput);
    setSaldo(v);
    setSaldoOpen(false);
  }

  function periodLabel(p: PeriodKey) {
    if (p === "7d") return "Siste 7 dager";
    if (p === "30d") return "Siste 30 dager";
    if (p === "month") return "Denne måneden";
    return "Alle tider";
  }

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Kort dashboard. Detaljer ligger under “Vis mer”.</div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>Penger</div>

        <div className="moneyBig">{fmtKr(saldo)}</div>

        <div className="itemMeta" style={{ marginTop: 10 }}>
          Utestående salg: <b>{fmtKr(unpaidSalesTotal)}</b> • Gjeld til deg: <b>{fmtKr(unpaidReceivablesTotal)}</b>
          <br />
          Total når alt er betalt: <b>{fmtKr(grand)}</b>
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" type="button" onClick={openSaldoModal}>
            Oppdater saldo
          </button>
          <button className="btn" type="button" onClick={() => setDetailsOpen(true)}>
            Vis mer
          </button>
        </div>
      </div>

      <div className="list">
        <div className="item">
          <p className="itemTitle">Siste 7 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(kpis.d7.revenue)}</b> • Profitt: <b>{fmtKr(kpis.d7.profit)}</b> • Salg: <b>{kpis.d7.count}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Siste 30 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(kpis.d30.revenue)}</b> • Profitt: <b>{fmtKr(kpis.d30.profit)}</b> • Salg: <b>{kpis.d30.count}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Denne måneden</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(kpis.month.revenue)}</b> • Profitt: <b>{fmtKr(kpis.month.profit)}</b> • Salg: <b>{kpis.month.count}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Totalt (alle tider)</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(kpis.all.revenue)}</b> • Profitt: <b>{fmtKr(kpis.all.profit)}</b> • Salg: <b>{kpis.all.count}</b>
          </div>
        </div>
      </div>

      <Modal open={detailsOpen} title="Detaljer" onClose={() => setDetailsOpen(false)}>
        <div className="fieldGrid" style={{ marginTop: 0 }}>
          <div>
            <label className="label">Periode</label>
            <select className="input" value={detailsPeriod} onChange={(e) => setDetailsPeriod(e.target.value as PeriodKey)}>
              <option value="7d">Siste 7 dager</option>
              <option value="30d">Siste 30 dager</option>
              <option value="month">Denne måneden</option>
              <option value="all">Alle tider</option>
            </select>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="cardTitle">Mest solgt ({periodLabel(detailsPeriod)})</div>
            <div className="cardSub">Topp basert på antall solgte enheter.</div>

            <div className="list">
              {mostSold.length === 0 ? (
                <div className="item">Ingen data.</div>
              ) : (
                mostSold.map((x) => (
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

          <div className="card">
            <div className="cardTitle">Salg pr kunde ({periodLabel(detailsPeriod)})</div>
            <div className="cardSub">Topp kunder (solgt/profitt/utestående).</div>

            <div className="list">
              {perCustomer.length === 0 ? (
                <div className="item">Ingen data.</div>
              ) : (
                perCustomer.map((c) => (
                  <div key={c.id} className="item">
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
        </div>
      </Modal>

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
            Tips: Saldo endres bare manuelt. Utestående oppdateres automatisk av salg/gjeld og innbetalinger.
          </div>
        </div>
      </Modal>
    </div>
  );
}
