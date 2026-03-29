import { useEffect, useMemo, useState } from "react";
import {
  customerTotalRemaining,
  ensureSeedData,
  fmtKr,
  getCustomers,
  getItems,
  getPurchases,
  getSaldo,
  getSales,
  lowStockItems,
  saleProfit,
  saleRemaining,
} from "../app/storage";
import type { Customer, InventoryItem, PurchaseRecord, SaleRecord } from "../types";

export default function Oversikt() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saldo, setSaldoState] = useState(0);

  useEffect(() => {
    ensureSeedData();
    setItems(getItems());
    setSales(getSales());
    setPurchases(getPurchases());
    setCustomers(getCustomers());
    setSaldoState(getSaldo());
  }, []);

  const stockValue = useMemo(
    () => items.reduce((sum, item) => sum + item.stock * item.costPrice, 0),
    [items]
  );

  const saleValue = useMemo(
    () => sales.reduce((sum, sale) => sum + sale.total, 0),
    [sales]
  );

  const purchaseValue = useMemo(
    () => purchases.reduce((sum, purchase) => sum + purchase.total, 0),
    [purchases]
  );

  const unpaidTotal = useMemo(
    () => sales.reduce((sum, sale) => sum + saleRemaining(sale), 0),
    [sales]
  );

  const profitTotal = useMemo(
    () => sales.reduce((sum, sale) => sum + saleProfit(sale), 0),
    [sales]
  );

  const lowStock = useMemo(() => lowStockItems(), [items]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();

    for (const sale of sales) {
      for (const line of sale.lines) {
        const key = line.itemId ?? line.itemName ?? line.id;
        const existing = map.get(key) ?? {
          name: line.itemName ?? "Uten navn",
          qty: 0,
          total: 0,
        };
        existing.qty += Number(line.qty || 0);
        existing.total += Number(line.lineTotal || 0);
        map.set(key, existing);
      }
    }

    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales]);

  const topCustomers = useMemo(() => {
    return customers
      .map((customer) => ({
        customer,
        remaining: customerTotalRemaining(customer.id),
      }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 5);
  }, [customers, sales]);

  const maxQty = Math.max(1, ...topProducts.map((x) => x.qty));

  return (
    <div>
      <h1 className="pageTitle">Oversikt</h1>

      <div className="grid4">
        <div className="card">
          <div className="cardTitle">Saldo</div>
          <div className="cardValue">{fmtKr(saldo)}</div>
          <div className="cardSub">Kontroll på beholdning og cashflow</div>
        </div>

        <div className="card">
          <div className="cardTitle">Lagerverdi</div>
          <div className="cardValue">{fmtKr(stockValue)}</div>
          <div className="cardSub">{items.length} aktive varer</div>
        </div>

        <div className="card">
          <div className="cardTitle">Salg totalt</div>
          <div className="cardValue">{fmtKr(saleValue)}</div>
          <div className="cardSub">Fortjeneste: {fmtKr(profitTotal)}</div>
        </div>

        <div className="card">
          <div className="cardTitle">Utestående</div>
          <div className="cardValue">{fmtKr(unpaidTotal)}</div>
          <div className="cardSub">Innkjøp totalt: {fmtKr(purchaseValue)}</div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="rowBetween">
            <h2 className="sectionTitle">Toppselgere</h2>
            <span className="badge badgeBlue">Graf</span>
          </div>

          <div className="sparkList">
            {topProducts.length === 0 ? (
              <div className="emptyState">Ingen salg enda</div>
            ) : (
              topProducts.map((item) => (
                <div key={item.name} className="sparkRow">
                  <div className="rowBetween">
                    <div>{item.name}</div>
                    <div className="muted">{item.qty} stk</div>
                  </div>
                  <div className="sparkBarWrap">
                    <div
                      className="sparkBar"
                      style={{ width: `${(item.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="rowBetween">
            <h2 className="sectionTitle">Varsler</h2>
            <span className={lowStock.length > 0 ? "badge badgeDanger" : "badge badgeSuccess"}>
              {lowStock.length > 0 ? `${lowStock.length} lav lager` : "Alt ser bra ut"}
            </span>
          </div>

          <div className="list">
            {lowStock.length === 0 ? (
              <div className="emptyState">Ingen varer under minimum nå.</div>
            ) : (
              lowStock.map((item) => (
                <div key={item.id} className="itemRow">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div className="muted">
                      Min: {item.minStock} • Nå: {item.stock}
                    </div>
                  </div>
                  <span className="badge badgeDanger">Bestill snart</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Siste salg</h2>
          <div className="list">
            {sales.length === 0 ? (
              <div className="emptyState">Ingen salg enda.</div>
            ) : (
              sales.slice(0, 6).map((sale) => (
                <div key={sale.id} className="itemRow">
                  <div>
                    <div style={{ fontWeight: 700 }}>{sale.customerName || "Kontantsalg"}</div>
                    <div className="muted">
                      {new Date(sale.createdAt).toLocaleString("no-NO")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{fmtKr(sale.total)}</div>
                    <div className="muted">
                      Rest: {fmtKr(saleRemaining(sale))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Kunder som skylder</h2>
          <div className="list">
            {topCustomers.length === 0 ? (
              <div className="emptyState">Ingen utestående kunder.</div>
            ) : (
              topCustomers.map(({ customer, remaining }) => (
                <div key={customer.id} className="itemRow">
                  <div>
                    <div style={{ fontWeight: 700 }}>{customer.name}</div>
                    <div className="muted">{customer.phone || customer.address || "Ingen ekstra info"}</div>
                  </div>
                  <span className="badge badgeGold">{fmtKr(remaining)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
