// src/pages/Oversikt.tsx
import React, { useMemo } from "react";
import { fmtKr, useCustomers, useItems, useSales } from "../app/storage";

export function Oversikt() {
  const { items } = useItems();
  const { customers } = useCustomers();
  const { sales } = useSales();

  const stats = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]));

    // Lagerverdier
    const lagerAntall = items.reduce((a, i) => a + (Number(i.stock) || 0), 0);
    const lagerKost = items.reduce((a, i) => a + (Number(i.cost) || 0) * (Number(i.stock) || 0), 0);
    const lagerSalgsverdi = items.reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.stock) || 0), 0);
    const lagerPotensiellProfitt = lagerSalgsverdi - lagerKost;

    const lavtLager = items.filter((i) => {
      const min = Number(i.minStock) || 0;
      if (min <= 0) return false;
      return (Number(i.stock) || 0) <= min;
    });

    // Salgsstatistikk (realiserte tall)
    const omsetning = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);

    const varekostSolgt = sales.reduce((a, s) => {
      const item = itemById.get(s.itemId);
      const cost = Number(item?.cost) || 0;
      const qty = Number(s.qty) || 0;
      return a + cost * qty;
    }, 0);

    const profitt = omsetning - varekostSolgt;
    const margin = omsetning > 0 ? (profitt / omsetning) * 100 : 0;

    const sisteSalg = sales.slice(0, 8);

    return {
      varer: items.length,
      kunder: customers.length,
      salg: sales.length,

      lagerAntall,
      lagerKost,
      lagerSalgsverdi,
      lagerPotensiellProfitt,
      lavtLager,

      omsetning,
      varekostSolgt,
      profitt,
      margin,

      sisteSalg,
    };
  }, [items, customers, sales]);

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">Nøkkeltall basert på lokal lagring (varer + salg + kunder).</div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Status</div>
        <div className="list">
          <div className="item">
            <p className="itemTitle">Totalt</p>
            <div className="itemMeta">
              Varer: <b>{stats.varer}</b> • Kunder: <b>{stats.kunder}</b> • Salg registrert: <b>{stats.salg}</b>
            </div>
          </div>

          <div className="item">
            <p className="itemTitle">Salg</p>
            <div className="itemMeta">
              Omsetning: <b>{fmtKr(stats.omsetning)}</b> • Varekost: <b>{fmtKr(stats.varekostSolgt)}</b> • Profitt:{" "}
              <b>{fmtKr(stats.profitt)}</b> • Margin: <b>{stats.margin.toFixed(1)}%</b>
            </div>
          </div>

          <div className="item">
            <p className="itemTitle">Lager</p>
            <div className="itemMeta">
              Antall på lager: <b>{stats.lagerAntall}</b> • Lagerverdi (kost): <b>{fmtKr(stats.lagerKost)}</b> •
              Lagerverdi (salgsverdi): <b>{fmtKr(stats.lagerSalgsverdi)}</b> • Potensiell profitt:{" "}
              <b>{fmtKr(stats.lagerPotensiellProfitt)}</b>
            </div>
            {stats.lavtLager.length > 0 ? (
              <div className="lowTag" style={{ marginTop: 10 }}>
                ⚠️ Lavt lager: {stats.lavtLager.length}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {stats.lavtLager.length > 0 ? (
        <div className="card">
          <div className="cardTitle">Lavt lager</div>
          <div className="list">
            {stats.lavtLager.slice(0, 10).map((i) => (
              <div key={i.id} className="item low">
                <p className="itemTitle">{i.name}</p>
                <div className="itemMeta">
                  Lager: <b>{i.stock}</b> • Min: <b>{i.minStock}</b>
                </div>
              </div>
            ))}
            {stats.lavtLager.length > 10 ? <div className="item">… + {stats.lavtLager.length - 10} flere</div> : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="cardTitle">Siste salg</div>
        <div className="list">
          {stats.sisteSalg.map((s) => (
            <div key={s.id} className="item">
              <p className="itemTitle">{s.itemName}</p>
              <div className="itemMeta">
                Antall: <b>{s.qty}</b> • Sum: <b>{fmtKr(s.total)}</b>
                {s.customerName ? (
                  <>
                    {" "}
                    • Kunde: <b>{s.customerName}</b>
                  </>
                ) : null}
              </div>
              <div className="itemMeta" style={{ marginTop: 6 }}>
                {new Date(s.createdAt).toLocaleString("nb-NO")}
              </div>
            </div>
          ))}
          {stats.sisteSalg.length === 0 ? <div className="item">Ingen salg registrert enda.</div> : null}
        </div>
      </div>
    </div>
  );
}
