// src/pages/Oversikt.tsx
import React, { useMemo } from "react";
import {
  fmtKr,
  saleRemaining,
  receivableRemaining,
  useCustomers,
  useItems,
  useReceivables,
  useSales,
} from "../app/storage";

function isAfter(dateIso: string, from: Date) {
  const d = new Date(dateIso);
  return Number.isFinite(d.getTime()) && d.getTime() >= from.getTime();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function Oversikt() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales } = useSales();
  const { receivables } = useReceivables();

  const byItemId = useMemo(() => {
    const m = new Map<string, { cost: number; name: string }>();
    for (const it of items) m.set(it.id, { cost: Number(it.cost ?? 0), name: it.name });
    return m;
  }, [items]);

  const from7 = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const from30 = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), []);
  const fromMonth = useMemo(() => startOfMonth(new Date()), []);

  function calcProfitForSale(s: any) {
    const unitCost =
      Number.isFinite(Number(s.unitCostAtSale))
        ? Number(s.unitCostAtSale)
        : (byItemId.get(s.itemId)?.cost ?? 0); // fallback for gamle salg uten historikk
    const qty = Number(s.qty ?? 0);
    const unitPrice = Number(s.unitPrice ?? 0);
    return (unitPrice - unitCost) * qty;
  }

  const period = useMemo(() => {
    const all = sales;

    const s7 = all.filter((s) => isAfter(s.createdAt, from7));
    const s30 = all.filter((s) => isAfter(s.createdAt, from30));
    const sm = all.filter((s) => isAfter(s.createdAt, fromMonth));

    function sumRevenue(list: any[]) {
      return list.reduce((a, b) => a + (Number(b.total) || 0), 0);
    }
    function sumProfit(list: any[]) {
      return list.reduce((a, b) => a + calcProfitForSale(b), 0);
    }

    const unpaidSalesTotal = all.reduce((a, s) => a + Math.max(0, saleRemaining(s)), 0);
    const unpaidReceivablesTotal = receivables.reduce((a, r) => a + Math.max(0, receivableRemaining(r)), 0);

    return {
      s7,
      s30,
      sm,
      revenue7: sumRevenue(s7),
      profit7: sumProfit(s7),
      revenue30: sumRevenue(s30),
      profit30: sumProfit(s30),
      revenueM: sumRevenue(sm),
      profitM: sumProfit(sm),
      unpaidSalesTotal,
      unpaidReceivablesTotal,
    };
  }, [sales, receivables, from7, from30, fromMonth, byItemId]);

  const perCustomer30 = useMemo(() => {
    const map = new Map<
      string,
      { customerId?: string; customerName: string; revenue: number; profit: number; unpaid: number; count: number }
    >();

    const list = sales.filter((s) => isAfter(s.createdAt, from30));

    for (const s of list) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName ||
        (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) ||
        "Anonym";

      const prev =
        map.get(key) || { customerId: s.customerId, customerName: name, revenue: 0, profit: 0, unpaid: 0, count: 0 };

      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;

      const rem = Math.max(0, saleRemaining(s));
      if (rem > 0) prev.unpaid += rem;

      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [sales, customers, from30, byItemId]);

  const perCustomerAll = useMemo(() => {
    const map = new Map<
      string,
      { customerId?: string; customerName: string; revenue: number; profit: number; unpaid: number; count: number }
    >();

    for (const s of sales) {
      const key = s.customerId ? `c:${s.customerId}` : "anon";
      const name =
        s.customerName ||
        (s.customerId ? customers.find((c) => c.id === s.customerId)?.name : null) ||
        "Anonym";

      const prev =
        map.get(key) || { customerId: s.customerId, customerName: name, revenue: 0, profit: 0, unpaid: 0, count: 0 };

      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;

      const rem = Math.max(0, saleRemaining(s));
      if (rem > 0) prev.unpaid += rem;

      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [sales, customers, byItemId]);

  const lastUnpaid = useMemo(() => {
    return sales.filter((s) => saleRemaining(s) > 0).slice(0, 10);
  }, [sales]);

  const inventory = useMemo(() => {
    const rows = items
      .map((it) => {
        const stock = Number(it.stock || 0);
        const price = Number(it.price || 0);
        const cost = Number(it.cost || 0);
        const valueSell = stock * price;
        const valueCost = stock * cost;
        const valueProfit = valueSell - valueCost;

        return {
          id: it.id,
          name: it.name,
          stock,
          price,
          cost,
          valueSell,
          valueCost,
          valueProfit,
        };
      })
      .sort((a, b) => b.valueCost - a.valueCost);

    const totalSell = rows.reduce((a, r) => a + r.valueSell, 0);
    const totalCost = rows.reduce((a, r) => a + r.valueCost, 0);
    const totalProfit = rows.reduce((a, r) => a + r.valueProfit, 0);

    return { rows, totalSell, totalCost, totalProfit };
  }, [items]);

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Salg, profitt, utestående (salg) og gjeld til deg (egen).</div>

      {/* Period stats */}
      <div className="list">
        <div className="item">
          <p className="itemTitle">Siste 7 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenue7)}</b> • Faktisk profitt: <b>{fmtKr(period.profit7)}</b> • Antall salg:{" "}
            <b>{period.s7.length}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Siste 30 dager</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenue30)}</b> • Faktisk profitt: <b>{fmtKr(period.profit30)}</b> • Antall salg:{" "}
            <b>{period.s30.length}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Denne måneden</p>
          <div className="itemMeta">
            Solgt: <b>{fmtKr(period.revenueM)}</b> • Faktisk profitt: <b>{fmtKr(period.profitM)}</b> • Antall salg:{" "}
            <b>{period.sm.length}</b>
          </div>
        </div>

        <div className="item">
          <p className="itemTitle">Utestående</p>
          <div className="itemMeta">
            Utestående salg (delbetaling): <b>{fmtKr(period.unpaidSalesTotal)}</b>
            <br />
            Gjeld til deg (egen, delbetaling): <b>{fmtKr(period.unpaidReceivablesTotal)}</b>
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div className="card">
        <div className="cardTitle">Lagerverdi</div>
        <div className="cardSub">
          Samlet salgsverdi: <b>{fmtKr(inventory.totalSell)}</b> • Samlet kost: <b>{fmtKr(inventory.totalCost)}</b> •
          Teoretisk fortjeneste: <b>{fmtKr(inventory.totalProfit)}</b>
        </div>

        <div className="list">
          {inventory.rows.length === 0 ? (
            <div className="item">Ingen varer enda.</div>
          ) : (
            inventory.rows.slice(0, 60).map((r) => (
              <div key={r.id} className="item">
                <p className="itemTitle">{r.name}</p>
                <div className="itemMeta">
                  Lager: <b>{r.stock}</b> • Pris/stk: <b>{fmtKr(r.price)}</b> • Kost/stk: <b>{fmtKr(r.cost)}</b>
                  <br />
                  Lagerverdi (pris): <b>{fmtKr(r.valueSell)}</b> • Lagerkost: <b>{fmtKr(r.valueCost)}</b> • Potensiell:{" "}
                  <b>{fmtKr(r.valueProfit)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Per-customer */}
      <div className="card">
        <div className="cardTitle">Salg pr kunde (30 dager)</div>
        <div className="cardSub">Inntekt, faktisk profitt og utestående pr kunde.</div>

        <div className="list">
          {perCustomer30.length === 0 ? (
            <div className="item">Ingen salg siste 30 dager.</div>
          ) : (
            perCustomer30.slice(0, 20).map((c) => (
              <div key={(c.customerId ?? "anon") + "_30"} className="item">
                <p className="itemTitle">{c.customerName}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> •
                  Utestående: <b>{fmtKr(c.unpaid)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Salg pr kunde (totalt)</div>
        <div className="cardSub">God for å se “tjent inn pr kunde” over tid.</div>

        <div className="list">
          {perCustomerAll.length === 0 ? (
            <div className="item">Ingen salg registrert enda.</div>
          ) : (
            perCustomerAll.slice(0, 20).map((c) => (
              <div key={(c.customerId ?? "anon") + "_all"} className="item">
                <p className="itemTitle">{c.customerName}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(c.revenue)}</b> • Profitt: <b>{fmtKr(c.profit)}</b> • Salg: <b>{c.count}</b> •
                  Utestående: <b>{fmtKr(c.unpaid)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick unpaid list */}
      <div className="card">
        <div className="cardTitle">Siste utestående salg</div>
        <div className="cardSub">Viser utestående (delbetaling). Markering/innbetaling gjøres i Salg-fanen.</div>

        <div className="list">
          {lastUnpaid.length === 0 ? (
            <div className="item">Ingen utestående salg 🎉</div>
          ) : (
            lastUnpaid.map((s) => (
              <div key={s.id} className="item low">
                <p className="itemTitle">{s.itemName}</p>
                <div className="itemMeta">
                  Sum: <b>{fmtKr(s.total)}</b> • Utestående: <b>{fmtKr(Math.max(0, saleRemaining(s)))}</b>
                  {s.customerName ? (
                    <>
                      {" "}
                      • Kunde: <b>{s.customerName}</b>
                    </>
                  ) : null}
                  <br />
                  {new Date(s.createdAt).toLocaleString("nb-NO")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Note about cost history */}
      <div className="card">
        <div className="cardTitle">NB om profitt</div>
        <div className="cardSub" style={{ marginBottom: 0 }}>
          Nye salg bør lagre <b>unitCostAtSale</b> (kost pr stk på salgstidspunktet). Gamle salg uten feltet beregnes med
          dagens vare-kost som fallback.
        </div>
      </div>
    </div>
  );
}
