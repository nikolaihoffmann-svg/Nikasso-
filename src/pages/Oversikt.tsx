// src/pages/Oversikt.tsx
import React, { useMemo } from "react";
import { fmtKr, round2, useItems, useReceivables, useSales } from "../app/storage";

export function Oversikt() {
  const { items } = useItems();
  const { sales } = useSales();
  const { receivables } = useReceivables();

  const inv = useMemo(() => {
    const rows = items
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb-NO", { sensitivity: "base" }))
      .map((i) => {
        const stock = Number(i.stock ?? 0);
        const cost = Number(i.cost ?? 0);
        const price = Number(i.price ?? 0);
        const costTotal = round2(stock * cost);
        const saleTotal = round2(stock * price);
        const profitPotential = round2(saleTotal - costTotal);
        const isLow = (i.minStock ?? 0) > 0 && stock <= (i.minStock ?? 0);

        return { ...i, costTotal, saleTotal, profitPotential, isLow };
      });

    const totalStock = rows.reduce((a, r) => a + (Number(r.stock ?? 0) || 0), 0);
    const totalCost = round2(rows.reduce((a, r) => a + (r.costTotal || 0), 0));
    const totalSale = round2(rows.reduce((a, r) => a + (r.saleTotal || 0), 0));
    const totalProfitPotential = round2(totalSale - totalCost);
    const lowCount = rows.reduce((a, r) => a + (r.isLow ? 1 : 0), 0);

    return { rows, totalStock, totalCost, totalSale, totalProfitPotential, lowCount };
  }, [items]);

  const outstandingSales = useMemo(() => {
    const unpaid = sales.filter((s) => !s.paid);
    const sum = round2(unpaid.reduce((a, s) => a + (Number(s.total) || 0), 0));
    return { count: unpaid.length, sum };
  }, [sales]);

  const outstandingReceivables = useMemo(() => {
    const unpaid = receivables.filter((r) => !r.paid);
    const sum = round2(unpaid.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    return { count: unpaid.length, sum };
  }, [receivables]);

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">
        Lager pr vare + samlet lagerverdi, utestående salg (ikke betalt), og gjeld til deg (ikke betalt).
      </div>

      <div className="statsGrid">
        <div className="stat">
          <p className="statLabel">Utestående salg</p>
          <p className="statValue">{fmtKr(outstandingSales.sum)}</p>
          <div className="cardSub" style={{ margin: "8px 0 0 0" }}>
            {outstandingSales.count} salg ikke betalt
          </div>
        </div>

        <div className="stat">
          <p className="statLabel">Gjeld til deg</p>
          <p className="statValue">{fmtKr(outstandingReceivables.sum)}</p>
          <div className="cardSub" style={{ margin: "8px 0 0 0" }}>
            {outstandingReceivables.count} poster ikke betalt
          </div>
        </div>

        <div className="stat">
          <p className="statLabel">Lagerverdi (kost)</p>
          <p className="statValue">{fmtKr(inv.totalCost)}</p>
          <div className="cardSub" style={{ margin: "8px 0 0 0" }}>
            Totalt lager: {inv.totalStock} stk
          </div>
        </div>

        <div className="stat">
          <p className="statLabel">Lagerverdi (salgsverdi)</p>
          <p className="statValue">{fmtKr(inv.totalSale)}</p>
          <div className="cardSub" style={{ margin: "8px 0 0 0" }}>
            Profitt-potensial: {fmtKr(inv.totalProfitPotential)}
            {inv.lowCount > 0 ? ` • Lavt lager: ${inv.lowCount}` : ""}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Lager pr vare</div>
        <div className="cardSub">
          Viser lager (stk), kost totalt, salgsverdi totalt, og profitt-potensial pr vare.
        </div>

        <div className="list">
          {inv.rows.map((r) => (
            <div key={r.id} className={r.isLow ? "item low" : "item"}>
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{r.name}</p>
                  <div className="itemMeta">
                    Lager: <b>{r.stock}</b> stk • Kost/stk: <b>{fmtKr(r.cost)}</b> • Pris/stk: <b>{fmtKr(r.price)}</b> • Min:{" "}
                    <b>{r.minStock}</b>
                  </div>
                  <div className="itemMeta" style={{ marginTop: 6 }}>
                    Kost totalt: <b>{fmtKr(r.costTotal)}</b> • Salgsverdi totalt: <b>{fmtKr(r.saleTotal)}</b> • Profitt-potensial:{" "}
                    <b>{fmtKr(r.profitPotential)}</b>
                  </div>
                  {r.isLow ? <div className="lowTag">⚠️ Lavt lager (≤ {r.minStock})</div> : null}
                </div>
              </div>
            </div>
          ))}

          {inv.rows.length === 0 ? <div className="item">Ingen varer lagt inn enda.</div> : null}
        </div>
      </div>
    </div>
  );
}
