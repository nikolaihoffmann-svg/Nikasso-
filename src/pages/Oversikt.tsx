import { useMemo } from "react";
import {
  customerTotalRemaining,
  fmtKr,
  getCustomers,
  getItems,
  getPurchases,
  getSaldo,
  getSales,
  salePaidSum,
  saleRemaining,
} from "../app/storage";
import type { InventoryItem } from "../types";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function inventoryValue(items: InventoryItem[]): number {
  return items.reduce((sum, item) => {
    const cost = Number(item.costPrice ?? item.cost ?? 0);
    return sum + cost * Number(item.stock || 0);
  }, 0);
}

export default function Oversikt() {
  const customers = useMemo(() => getCustomers(), []);
  const items = useMemo(() => getItems(), []);
  const sales = useMemo(() => getSales(), []);
  const purchases = useMemo(() => getPurchases(), []);
  const saldo = useMemo(() => getSaldo(), []);

  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totalPaid = sales.reduce((sum, sale) => sum + salePaidSum(sale), 0);
  const totalOpen = sales.reduce((sum, sale) => sum + saleRemaining(sale), 0);
  const purchaseTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const stockValue = inventoryValue(items);

  const saleTotals = sales.map((sale) => Number(sale.total || 0));
  const avgSale = average(saleTotals);
  const medianSale = median(saleTotals);

  const lowStockItems = items
    .filter((item) => Number(item.stock || 0) <= Number(item.minStock || 0))
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
    .slice(0, 6);

  const topDebtors = customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      remaining: customerTotalRemaining(customer.id),
    }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 6);

  const recentSales = [...sales]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);

  const paidRatio = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
  const debtRatio = totalRevenue > 0 ? (totalOpen / totalRevenue) * 100 : 0;

  const activeItems = items.filter((item) => item.isActive !== false).length;
  const outOfStock = items.filter((item) => Number(item.stock || 0) <= 0).length;

  return (
    <div>
      <h1 style={{ fontSize: 44, marginBottom: 8 }}>Oversikt</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: "#94a3b8" }}>
        Nerdete driftstall, lager, cashflow og utestående — men lett å lese.
      </p>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 16,
        }}
      >
        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Saldo</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(Number(saldo || 0))}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt omsatt</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(totalRevenue)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt utestående</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(totalOpen)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Lagerverdi</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(stockValue)}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 16,
        }}
      >
        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Snittsalg</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtKr(avgSale)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Median salg</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtKr(medianSale)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Innbetalt andel</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{paidRatio.toFixed(0)}%</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Utestående andel</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{debtRatio.toFixed(0)}%</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Aktive varer</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{activeItems}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Tomt på lager</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{outOfStock}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1.2fr 1fr",
          marginBottom: 16,
        }}
      >
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Kunder som skylder mest</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {topDebtors.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>Ingen utestående kunder akkurat nå.</div>
            ) : (
              topDebtors.map((customer) => (
                <div
                  key={customer.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div>{customer.name}</div>
                  <div style={{ fontWeight: 800 }}>{fmtKr(customer.remaining)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Lav lagerbeholdning</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {lowStockItems.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>Ingen varer under minimum.</div>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ color: "#94a3b8", marginTop: 4 }}>
                      Min: {item.minStock}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>Lager: {item.stock}</div>
                    <div style={{ color: "#94a3b8", marginTop: 4 }}>
                      Kost: {fmtKr(Number(item.costPrice ?? item.cost ?? 0))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Siste salg</h2>

        <div style={{ display: "grid", gap: 10 }}>
          {recentSales.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>Ingen salg registrert enda.</div>
          ) : (
            recentSales.map((sale) => (
              <div
                key={sale.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{sale.customerName || "Kontantsalg"}</div>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>
                    {new Date(sale.createdAt).toLocaleString("no-NO")}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800 }}>{fmtKr(sale.total)}</div>
                  <div style={{ color: "#94a3b8", marginTop: 4 }}>
                    Rest: {fmtKr(saleRemaining(sale))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 16,
        }}
      >
        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Innkjøp totalt</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtKr(purchaseTotal)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Brutto differanse</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>
            {fmtKr(totalRevenue - purchaseTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
