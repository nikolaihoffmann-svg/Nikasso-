// src/pages/Oversikt.tsx
import React, { useMemo } from "react";
import { fmtKr, round2, useItems, useSales } from "../app/storage";

export function Oversikt() {
  const { items } = useItems();
  const { sales } = useSales();

  const stats = useMemo(() => {
    const count = items.length;
    const totalStock = items.reduce((a, b) => a + (b.stock || 0), 0);
    const costTotal = items.reduce((a, b) => a + (b.cost || 0) * (b.stock || 0), 0);
    const saleTotal = items.reduce((a, b) => a + (b.price || 0) * (b.stock || 0), 0);

    const low = items
      .filter((i) => (i.minStock ?? 0) > 0 && (i.stock ?? 0) <= (i.minStock ?? 0))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

    const revenue = sales.reduce((a, b) => a + (b.total || 0), 0);

    return {
      count,
      totalStock,
      costTotal: round2(costTotal),
      saleTotal: round2(saleTotal),
      low,
      revenue: round2(revenue),
    };
  }, [items, sales]);

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">
        Antall varer: <b>{stats.count}</b> • Lager totalt: <b>{stats.totalStock}</b> • Lagerverdi (kost): <b>{fmtKr(stats.costTotal)}</b> •
        (salgsverdi): <b>{fmtKr(stats.saleTotal)}</b>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">Lav lagerbeholdning</div>
        <div className="cardSub">Varer som er på eller under minimum (min &gt; 0).</div>

        <div className="list">
          {stats.low.map((i) => (
            <div key={i.id} className="item low">
              <div className="itemTop">
                <div>
                  <p className="itemTitle">{i.name}</p>
                  <div className="itemMeta">
                    Lager: <b>{i.stock}</b> • Minimum: <b>{i.minStock}</b>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {stats.low.length === 0 ? <div className="item">Ingen varsler 🎉</div> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">Salg (sum)</div>
        <div className="cardSub">
          Totalt registrert salg: <b>{fmtKr(stats.revenue)}</b>
        </div>
      </div>
    </div>
  );
}
