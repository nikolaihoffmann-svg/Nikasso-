import { useEffect, useMemo, useState } from "react";
import { addPaymentToSale, fmtKr, getSales, saleRemaining } from "../app/storage";
import type { SaleRecord } from "../types";

export default function Gjeld() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  function refresh(): void {
    setSales(getSales());
  }

  useEffect(() => {
    refresh();
  }, []);

  const receivables = useMemo(() => {
    const q = query.trim().toLowerCase();

    return sales
      .map((sale) => ({
        sale,
        remaining: saleRemaining(sale),
      }))
      .filter((x) => x.remaining > 0)
      .filter((x) => {
        if (!q) return true;
        return (x.sale.customerName || "kontantsalg").toLowerCase().includes(q);
      })
      .sort((a, b) => b.remaining - a.remaining);
  }, [sales, query]);

  const totalOpen = receivables.reduce((sum, x) => sum + x.remaining, 0);
  const totalCount = receivables.length;
  const biggestOpen = receivables[0]?.remaining ?? 0;

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
      <p className="pageLead">Åpne poster, raske betalinger og full oversikt.</p>

      <div className="grid3">
        <div className="statCard">
          <div className="statLabel">Totalt utestående</div>
          <div className="statValue">{fmtKr(totalOpen)}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Åpne poster</div>
          <div className="statValue">{totalCount}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Største åpne post</div>
          <div className="statValue">{fmtKr(biggestOpen)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk kunde..."
        />
      </div>

      <div className="receivableList" style={{ marginTop: 16 }}>
        {receivables.length === 0 ? (
          <div className="card emptyText">Ingen åpne poster.</div>
        ) : (
          receivables.map(({ sale, remaining }) => (
            <div key={sale.id} className="card">
              <div className="rowBetween" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {sale.customerName || "Kontantsalg"}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {new Date(sale.createdAt).toLocaleString("no-NO")}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtKr(remaining)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Total: {fmtKr(sale.total)}
                  </div>
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

                <div className="cardActions" style={{ marginTop: 0 }}>
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
  );
}
