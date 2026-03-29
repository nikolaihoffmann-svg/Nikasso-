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
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const paidRatio = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
  const debtRatio = totalRevenue > 0 ? (totalOpen / totalRevenue) * 100 : 0;

  const activeItems = items.filter((item) => item.isActive !== false).length;
  const outOfStock = items.filter((item) => Number(item.stock || 0) <= 0).length;

  return (
    <div>
      <h1 className="pageTitle">Oversikt</h1>
      <p className="pageLead">
        Nerdete driftstall, lager, cashflow og utestående — men lett å lese.
      </p>

      <div className="statsGrid">
        <div className="statCard">
          <div className="statLabel">Saldo</div>
          <div className="statValue">{fmtKr(Number(saldo || 0))}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Totalt omsatt</div>
          <div className="statValue">{fmtKr(totalRevenue)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Totalt utestående</div>
          <div className="statValue">{fmtKr(totalOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Lagerverdi</div>
          <div className="statValue">{fmtKr(stockValue)}</div>
        </div>
      </div>

      <div className="statsGridSmall" style={{ marginTop: 14 }}>
        <div className="infoCard">
          <div className="infoLabel">Snittsalg</div>
          <div className="statMiniValue">{fmtKr(avgSale)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Median salg</div>
          <div className="statMiniValue">{fmtKr(medianSale)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Innbetalt andel</div>
          <div className="statMiniValue">{paidRatio.toFixed(0)}%</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Utestående andel</div>
          <div className="statMiniValue">{debtRatio.toFixed(0)}%</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Aktive varer</div>
          <div className="statMiniValue">{activeItems}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Tomt på lager</div>
          <div className="statMiniValue">{outOfStock}</div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Kunder som skylder mest</h2>

          <div className="featureList">
            {topDebtors.length === 0 ? (
              <div className="emptyText">Ingen utestående kunder akkurat nå.</div>
            ) : (
              topDebtors.map((customer) => (
                <div key={customer.id} className="featureRow">
                  <div>
                    <div className="featureRowTitle">{customer.name}</div>
                  </div>
                  <div className="featureRowRight">{fmtKr(customer.remaining)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Lav lagerbeholdning</h2>

          <div className="featureList">
            {lowStockItems.length === 0 ? (
              <div className="emptyText">Ingen varer under minimum.</div>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="featureRow">
                  <div>
                    <div className="featureRowTitle">{item.name}</div>
                    <div className="featureRowSub">Min: {item.minStock}</div>
                  </div>

                  <div className="featureRowRight">
                    <div>Lager: {item.stock}</div>
                    <div className="featureRowSub">
                      Kost: {fmtKr(Number(item.costPrice ?? item.cost ?? 0))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="sectionTitle">Siste salg</h2>

        <div className="featureList">
          {recentSales.length === 0 ? (
            <div className="emptyText">Ingen salg registrert enda.</div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="featureRow">
                <div>
                  <div className="featureRowTitle">{sale.customerName || "Kontantsalg"}</div>
                  <div className="featureRowSub">
                    {new Date(sale.createdAt).toLocaleString("no-NO")}
                  </div>
                </div>

                <div className="featureRowRight">
                  <div>{fmtKr(sale.total)}</div>
                  <div className="featureRowSub">Rest: {fmtKr(saleRemaining(sale))}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="infoCard">
          <div className="infoLabel">Innkjøp totalt</div>
          <div className="statMiniValue">{fmtKr(purchaseTotal)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Brutto differanse</div>
          <div className="statMiniValue">{fmtKr(totalRevenue - purchaseTotal)}</div>
        </div>
      </div>
    </div>
  );
}
