import { useEffect, useMemo, useState } from "react";
import { addPaymentToSale, fmtKr, getSales, saleRemaining } from "../app/storage";
import type { SaleRecord } from "../types";

export default function Gjeld() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  function refresh(): void {
    setSales(getSales());
  }

  useEffect(() => {
    refresh();
  }, []);

  const receivables = useMemo(() => {
    return sales
      .map((sale) => ({
        sale,
        remaining: saleRemaining(sale),
      }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [sales]);

  function handlePay(saleId: string): void {
    const amount = Number(amounts[saleId] || 0);
    if (amount <= 0) return;
    addPaymentToSale(saleId, amount, "Registrert fra Gjeld");
    setAmounts((prev) => ({ ...prev, [saleId]: "" }));
    refresh();
  }

  return (
    <div>
      <h1 className="pageTitle">Gjeld</h1>

      <div className="card">
        <div className="rowBetween">
          <h2 className="sectionTitle">Åpne poster</h2>
          <span className="badge badgeGold">
            Totalt: {fmtKr(receivables.reduce((sum, x) => sum + x.remaining, 0))}
          </span>
        </div>

        <div className="list">
          {receivables.length === 0 ? (
            <div className="emptyState">Ingen åpne poster.</div>
          ) : (
            receivables.map(({ sale, remaining }) => (
              <div key={sale.id} className="itemRow" style={{ display: "grid", gap: 12 }}>
                <div className="rowBetween">
                  <div>
                    <div style={{ fontWeight: 800 }}>{sale.customerName || "Kontantsalg"}</div>
                    <div className="muted">
                      {new Date(sale.createdAt).toLocaleString("no-NO")}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{fmtKr(remaining)}</div>
                    <div className="muted">Total: {fmtKr(sale.total)}</div>
                  </div>
                </div>

                <div className="grid2">
                  <label className="label">
                    <span>Registrer betaling</span>
                    <input
                      type="number"
                      value={amounts[sale.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((prev) => ({ ...prev, [sale.id]: e.target.value }))
                      }
                      placeholder="Beløp"
                    />
                  </label>

                  <div className="label" style={{ justifyContent: "end" }}>
                    <span>&nbsp;</span>
                    <button className="btn btnSuccess" type="button" onClick={() => handlePay(sale.id)}>
                      Registrer betaling
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
