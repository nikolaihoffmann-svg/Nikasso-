// src/pages/Oversikt.tsx
import React, { useMemo } from "react";
import {
  fmtKr,
  round2,
  salePaidSum,
  saleRemaining,
  receivablePaidSum,
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
  const { sales, setPaid } = useSales();
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

  const inventory = useMemo(() => {
    const per = items
      .map((i) => {
        const stock = Number(i.stock ?? 0);
        const cost = Number(i.cost ?? 0);
        const price = Number(i.price ?? 0);

        const costTotal = round2(stock * cost);
        const saleTotal = round2(stock * price);
        const potentialProfit = round2(saleTotal - costTotal);

        return {
          id: i.id,
          name: i.name,
          stock,
          cost,
          price,
          costTotal,
          saleTotal,
          potentialProfit,
          low: (Number(i.minStock ?? 0) > 0) && stock <= Number(i.minStock ?? 0),
          minStock: Number(i.minStock ?? 0),
        };
      })
      .sort((a, b) => b.costTotal - a.costTotal);

    const totalCost = round2(per.reduce((a, b) => a + b.costTotal, 0));
    const totalSale = round2(per.reduce((a, b) => a + b.saleTotal, 0));
    const totalPotentialProfit = round2(totalSale - totalCost);
    const lowCount = per.reduce((a, b) => a + (b.low ? 1 : 0), 0);

    return { per, totalCost, totalSale, totalPotentialProfit, lowCount };
  }, [items]);

  const period = useMemo(() => {
    const all = sales;

    const s7 = all.filter((s) => isAfter(s.createdAt, from7));
    const s30 = all.filter((s) => isAfter(s.createdAt, from30));
    const sm = all.filter((s) => isAfter(s.createdAt, fromMonth));

    function sumRevenue(list: any[]) {
      return round2(list.reduce((a, b) => a + (Number(b.total) || 0), 0));
    }
    function sumProfit(list: any[]) {
      return round2(list.reduce((a, b) => a + calcProfitForSale(b), 0));
    }

    const unpaidSalesTotal = round2(all.reduce((a, s) => a + saleRemaining(s), 0));
    const unpaidReceivablesTotal = round2(receivables.reduce((a, r) => a + receivableRemaining(r), 0));

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

      const prev = map.get(key) || { customerId: s.customerId, customerName: name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      prev.unpaid += saleRemaining(s);
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

      const prev = map.get(key) || { customerId: s.customerId, customerName: name, revenue: 0, profit: 0, unpaid: 0, count: 0 };
      prev.revenue += Number(s.total) || 0;
      prev.profit += calcProfitForSale(s);
      prev.count += 1;
      prev.unpaid += saleRemaining(s);
      map.set(key, prev);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [sales, customers, byItemId]);

  const lastUnpaid = useMemo(() => {
    return sales.filter((s) => saleRemaining(s) > 0).slice(0, 10);
  }, [sales]);

  const lastReceivables = useMemo(() => {
    return receivables.filter((r) => receivableRemaining(r) > 0).slice(0, 10);
  }, [receivables]);

  return (
    <div className="card">
      <div className="cardTitle">Oversikt</div>
      <div className="cardSub">
        Lager (pr vare + total), salg/profitt (7/30/mnd), utestående salg (delbetaling), og gjeld til deg (egen).
      </div>

      {/* Lager */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="cardTitle">Lagerverdi</div>
        <div className="cardSub">
          Total kostverdi: <b>{fmtKr(inventory.totalCost)}</b> • Total salgsverdi: <b>{fmtKr(inventory.totalSale)}</b> •
          Potensiell profitt: <b>{fmtKr(inventory.totalPotentialProfit)}</b>
          {inventory.lowCount > 0 ? (
            <>
              {" "}
              • <b>⚠️ Lavt lager: {inventory.lowCount}</b>
            </>
          ) : null}
        </div>

        <div className="list">
          {inventory.per.length === 0 ? (
            <div className="item">Ingen varer registrert enda.</div>
          ) : (
            inventory.per.slice(0, 60).map((i) => (
              <div key={i.id} className={i.low ? "item low" : "item"}>
                <p className="itemTitle">{i.name}</p>
                <div className="itemMeta">
                  Lager: <b>{i.stock}</b>
                  {i.minStock > 0 ? (
                    <>
                      {" "}
                      • Min: <b>{i.minStock}</b>
                    </>
                  ) : null}
                  <br />
                  Kost pr stk: <b>{fmtKr(i.cost)}</b> • Kost totalt: <b>{fmtKr(i.costTotal)}</b>
                  <br />
                  Salg pr stk: <b>{fmtKr(i.price)}</b> • Salgsverdi totalt: <b>{fmtKr(i.saleTotal)}</b> • Pot. profitt:{" "}
                  <b>{fmtKr(i.potentialProfit)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Period stats */}
      <div className="card">
        <div className="cardTitle">Salg og profitt</div>
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
              Utestående salg (gjenstår): <b>{fmtKr(period.unpaidSalesTotal)}</b>
              <br />
              Gjeld til deg (egen, gjenstår): <b>{fmtKr(period.unpaidReceivablesTotal)}</b>
            </div>
          </div>
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
            perCustomer30.slice(0, 30).map((c) => (
              <div key={(c.customerId ?? "anon") + "_30"} className="item">
                <p className="itemTitle">{c.customerName}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(round2(c.revenue))}</b> • Profitt: <b>{fmtKr(round2(c.profit))}</b> • Salg: <b>{c.count}</b> •
                  Utestående: <b>{fmtKr(round2(c.unpaid))}</b>
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
            perCustomerAll.slice(0, 30).map((c) => (
              <div key={(c.customerId ?? "anon") + "_all"} className="item">
                <p className="itemTitle">{c.customerName}</p>
                <div className="itemMeta">
                  Solgt: <b>{fmtKr(round2(c.revenue))}</b> • Profitt: <b>{fmtKr(round2(c.profit))}</b> • Salg: <b>{c.count}</b> •
                  Utestående: <b>{fmtKr(round2(c.unpaid))}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick unpaid sales */}
      <div className="card">
        <div className="cardTitle">Siste utestående salg</div>
        <div className="cardSub">Her ser du delbetaling (betalt + gjenstår). Du kan markere “ferdig betalt”.</div>

        <div className="list">
          {lastUnpaid.length === 0 ? (
            <div className="item">Ingen utestående salg 🎉</div>
          ) : (
            lastUnpaid.map((s) => (
              <div key={s.id} className="item">
                <p className="itemTitle">{s.itemName}</p>
                <div className="itemMeta">
                  Total: <b>{fmtKr(s.total)}</b> • Betalt: <b>{fmtKr(salePaidSum(s))}</b> • Gjenstår: <b>{fmtKr(saleRemaining(s))}</b>
                  {s.customerName ? (
                    <>
                      {" "}
                      • Kunde: <b>{s.customerName}</b>
                    </>
                  ) : null}
                  <br />
                  {new Date(s.createdAt).toLocaleString("nb-NO")}
                </div>

                <div className="btnRow">
                  <button className="btn btnPrimary" type="button" onClick={() => setPaid(s.id, true)}>
                    Sett ferdig betalt
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick unpaid receivables */}
      <div className="card">
        <div className="cardTitle">Siste utestående gjeld til deg</div>
        <div className="cardSub">Dette er “gjeld til deg” (egen liste) – også med delbetaling.</div>

        <div className="list">
          {lastReceivables.length === 0 ? (
            <div className="item">Ingen utestående gjeld 🎉</div>
          ) : (
            lastReceivables.map((r) => (
              <div key={r.id} className="item">
                <p className="itemTitle">
                  {r.debtorName} • {r.title}
                </p>
                <div className="itemMeta">
                  Total: <b>{fmtKr(r.amount)}</b> • Betalt: <b>{fmtKr(receivablePaidSum(r))}</b> • Gjenstår:{" "}
                  <b>{fmtKr(receivableRemaining(r))}</b>
                  {r.dueDate ? (
                    <>
                      {" "}
                      • Forfall: <b>{new Date(r.dueDate).toLocaleDateString("nb-NO")}</b>
                    </>
                  ) : null}
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
          Nye salg kan lagre <b>unitCostAtSale</b> (for 100% korrekt historikk). Gamle salg uten feltet beregnes med dagens vare-kost som
          fallback.
        </div>
      </div>
    </div>
  );
}
