import { useMemo } from "react";
import {
  customerDebtRemaining,
  customerTotalRemaining,
  fmtKr,
  getCustomers,
  getDebts,
  getItems,
  getPurchases,
  getSaldo,
  getSales,
  inventoryValue,
  projectedTotalValue,
  salePaidSum,
  saleProfit,
  saleRemaining,
  totalDebtOutstanding,
  totalReceivables,
  totalSalesOutstanding,
} from "../app/storage";
import type { InventoryItem, SaleRecord } from "../types";

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

function roundSafe(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumByMonth<T extends { createdAt: string }>(
  rows: T[],
  valueGetter: (row: T) => number
) {
  const map = new Map<string, number>();

  rows
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((row) => {
      const d = new Date(row.createdAt);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(
        d.getFullYear()
      ).slice(-2)}`;
      map.set(key, roundSafe((map.get(key) || 0) + valueGetter(row)));
    });

  return [...map.entries()].slice(-6);
}

function salesThisMonth(sales: SaleRecord[]): number {
  const now = new Date();
  return sales
    .filter((sale) => {
      const d = new Date(sale.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, sale) => sum + sale.total, 0);
}

function salesLast30Days(sales: SaleRecord[]): number {
  const now = Date.now();
  const days30 = 1000 * 60 * 60 * 24 * 30;
  return sales
    .filter((sale) => now - new Date(sale.createdAt).getTime() <= days30)
    .reduce((sum, sale) => sum + sale.total, 0);
}

export default function Oversikt() {
  const customers = useMemo(() => getCustomers(), []);
  const items = useMemo(() => getItems(), []);
  const sales = useMemo(() => getSales(), []);
  const purchases = useMemo(() => getPurchases(), []);
  const debts = useMemo(() => getDebts(), []);
  const saldo = useMemo(() => getSaldo(), []);

  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totalPaid = sales.reduce((sum, sale) => sum + salePaidSum(sale), 0);
  const salesOpen = totalSalesOutstanding();
  const debtsOpen = totalDebtOutstanding();
  const totalOpen = totalReceivables();
  const purchaseTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const stockValue = inventoryValue(items);
  const grossProfit = sales.reduce((sum, sale) => sum + saleProfit(sale), 0);
  const potentialTotal = projectedTotalValue();

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
      remaining: customerTotalRemaining(customer.id) + customerDebtRemaining(customer.id),
    }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 6);

  const recentSales = [...sales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const paidRatio = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
  const salesDebtRatio = totalRevenue > 0 ? (salesOpen / totalRevenue) * 100 : 0;
  const marginRatio = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const activeItems = items.filter((item) => item.isActive !== false).length;
  const outOfStock = items.filter((item) => Number(item.stock || 0) <= 0).length;
  const customerCountWithDebt = customers.filter(
    (x) => customerTotalRemaining(x.id) + customerDebtRemaining(x.id) > 0
  ).length;
  const monthSales = salesThisMonth(sales);
  const sales30 = salesLast30Days(sales);

  const salesByMonth = sumByMonth(sales, (sale) => Number(sale.total || 0));
  const paymentsByMonth = sumByMonth(sales, (sale) => salePaidSum(sale));
  const profitByMonth = sumByMonth(sales, (sale) => saleProfit(sale));

  const maxSalesMonth = Math.max(...salesByMonth.map(([, value]) => value), 1);
  const maxPaymentsMonth = Math.max(...paymentsByMonth.map(([, value]) => value), 1);
  const maxProfitMonth = Math.max(...profitByMonth.map(([, value]) => value), 1);

  const debtBars = [
    { label: "Utestående salg", value: salesOpen },
    { label: "Gjeld / lån", value: debtsOpen },
    { label: "Totalt til gode", value: totalOpen },
  ];

  const maxDebtBars = Math.max(...debtBars.map((x) => x.value), 1);
  const bestSale = saleTotals.length ? Math.max(...saleTotals) : 0;
  const lowestSale = saleTotals.length ? Math.min(...saleTotals) : 0;

  return (
    <div>
      <h1 className="pageTitle">Oversikt</h1>
      <p className="pageLead">
        Saldo, lager, utestående salg, egen gjeld og samlet potensiell totalverdi.
      </p>

      <div className="statsGrid">
        <div className="statCard">
          <div className="statLabel">Saldo nå</div>
          <div className="statValue">{fmtKr(Number(saldo || 0))}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Utestående salg</div>
          <div className="statValue debtText">{fmtKr(salesOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Gjeld / lån til gode</div>
          <div className="statValue debtText">{fmtKr(debtsOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Potensiell totalverdi</div>
          <div className="statValue">{fmtKr(potentialTotal)}</div>
        </div>
      </div>

      <div className="statsGridSmall" style={{ marginTop: 14 }}>
        <div className="infoCard">
          <div className="infoLabel">Totalt til gode</div>
          <div className="statMiniValue">{fmtKr(totalOpen)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Lagerverdi</div>
          <div className="statMiniValue">{fmtKr(stockValue)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Totalt omsatt</div>
          <div className="statMiniValue">{fmtKr(totalRevenue)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Brutto fortjeneste</div>
          <div className="statMiniValue">{fmtKr(grossProfit)}</div>
        </div>

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
          <div className="infoLabel">Utestående salg andel</div>
          <div className="statMiniValue debtText">{salesDebtRatio.toFixed(0)}%</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Bruttomargin</div>
          <div className="statMiniValue">{marginRatio.toFixed(0)}%</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Aktive varer</div>
          <div className="statMiniValue">{activeItems}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Tomt på lager</div>
          <div className="statMiniValue">{outOfStock}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Kunder med åpne beløp</div>
          <div className="statMiniValue">{customerCountWithDebt}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Omsatt denne måneden</div>
          <div className="statMiniValue">{fmtKr(monthSales)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Omsatt siste 30 dager</div>
          <div className="statMiniValue">{fmtKr(sales30)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Innkjøp totalt</div>
          <div className="statMiniValue">{fmtKr(purchaseTotal)}</div>
        </div>

        <div className="infoCard">
          <div className="infoLabel">Brutto differanse</div>
          <div className="statMiniValue">{fmtKr(totalRevenue - purchaseTotal)}</div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Hurtig innsikt</h2>

          <div className="featureList">
            <div className="featureRow">
              <div className="featureRowTitle">Beste salg</div>
              <div className="featureRowRight">{fmtKr(bestSale)}</div>
            </div>
            <div className="featureRow">
              <div className="featureRowTitle">Laveste salg</div>
              <div className="featureRowRight">{fmtKr(lowestSale)}</div>
            </div>
            <div className="featureRow">
              <div className="featureRowTitle">Antall salg</div>
              <div className="featureRowRight">{sales.length}</div>
            </div>
            <div className="featureRow">
              <div className="featureRowTitle">Antall gjeldsposter</div>
              <div className="featureRowRight">{debts.length}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Mest til gode per kunde</h2>

          <div className="featureList">
            {topDebtors.length === 0 ? (
              <div className="emptyText">Ingen åpne poster akkurat nå.</div>
            ) : (
              topDebtors.map((customer) => (
                <div key={customer.id} className="featureRow">
                  <div className="customerMain">
                    <div className="featureRowTitle">{customer.name}</div>
                  </div>
                  <div className="featureRowRight debtText">{fmtKr(customer.remaining)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Omsetning siste måneder</h2>
          <div className="miniChart">
            {salesByMonth.length === 0 ? (
              <div className="emptyText">Ikke nok data enda.</div>
            ) : (
              salesByMonth.map(([label, value]) => (
                <div key={label} className="chartRow">
                  <div className="chartLabel">{label}</div>
                  <div className="chartBarTrack">
                    <div
                      className="chartBarFill chartBarBlue"
                      style={{ width: `${(value / maxSalesMonth) * 100}%` }}
                    />
                  </div>
                  <div className="chartValue">{fmtKr(value)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Innbetaling siste måneder</h2>
          <div className="miniChart">
            {paymentsByMonth.length === 0 ? (
              <div className="emptyText">Ikke nok data enda.</div>
            ) : (
              paymentsByMonth.map(([label, value]) => (
                <div key={label} className="chartRow">
                  <div className="chartLabel">{label}</div>
                  <div className="chartBarTrack">
                    <div
                      className="chartBarFill chartBarGreen"
                      style={{ width: `${(value / maxPaymentsMonth) * 100}%` }}
                    />
                  </div>
                  <div className="chartValue">{fmtKr(value)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="sectionTitle">Fortjeneste siste måneder</h2>
          <div className="miniChart">
            {profitByMonth.length === 0 ? (
              <div className="emptyText">Ikke nok data enda.</div>
            ) : (
              profitByMonth.map(([label, value]) => (
                <div key={label} className="chartRow">
                  <div className="chartLabel">{label}</div>
                  <div className="chartBarTrack">
                    <div
                      className="chartBarFill chartBarGold"
                      style={{ width: `${(value / maxProfitMonth) * 100}%` }}
                    />
                  </div>
                  <div className="chartValue">{fmtKr(value)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="sectionTitle">Åpne beløp</h2>
          <div className="miniChart">
            {debtBars.map((row) => (
              <div key={row.label} className="chartRow">
                <div className="chartLabel">{row.label}</div>
                <div className="chartBarTrack">
                  <div
                    className="chartBarFill chartBarRed"
                    style={{ width: `${(row.value / maxDebtBars) * 100}%` }}
                  />
                </div>
                <div className="chartValue debtText">{fmtKr(row.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="sectionTitle">Lav lagerbeholdning</h2>

        <div className="featureList">
          {lowStockItems.length === 0 ? (
            <div className="emptyText">Ingen varer under minimum.</div>
          ) : (
            lowStockItems.map((item: InventoryItem) => (
              <div key={item.id} className="featureRow">
                <div className="customerMain">
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

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="sectionTitle">Siste salg</h2>

        <div className="featureList">
          {recentSales.length === 0 ? (
            <div className="emptyText">Ingen salg registrert enda.</div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="featureRow">
                <div className="customerMain">
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
    </div>
  );
}
