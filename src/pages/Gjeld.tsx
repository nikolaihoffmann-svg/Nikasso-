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
      <h1 style={{ fontSize: 44, marginBottom: 8 }}>Gjeld</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: "#94a3b8" }}>
        Åpne poster, raske betalinger og full oversikt.
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
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt utestående</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(totalOpen)}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Åpne poster</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{totalCount}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Største åpne post</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(biggestOpen)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk kunde..."
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {receivables.length === 0 ? (
          <div className="card" style={{ color: "#94a3b8" }}>
            Ingen åpne poster.
          </div>
        ) : (
          receivables.map(({ sale, remaining }) => (
            <div
              key={sale.id}
              className="card"
              style={{
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {sale.customerName || "Kontantsalg"}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: 6 }}>
                    {new Date(sale.createdAt).toLocaleString("no-NO")}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{fmtKr(remaining)}</div>
                  <div style={{ color: "#94a3b8", marginTop: 6 }}>
                    Total: {fmtKr(sale.total)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(140px, 220px) auto",
                  alignItems: "end",
                }}
              >
                <div>
                  <div style={{ color: "#94a3b8", marginBottom: 8 }}>Registrer betaling</div>
                  <input
                    type="number"
                    value={amounts[sale.id] ?? ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [sale.id]: e.target.value }))
                    }
                    placeholder="Beløp"
                  />
                </div>

                <button
                  className="dataBtn"
                  style={{
                    borderRadius: 14,
                    width: "auto",
                    height: "auto",
                    padding: "12px 18px",
                    background: "rgba(34,197,94,0.14)",
                    border: "1px solid rgba(34,197,94,0.28)",
                    color: "#d1fae5",
                  }}
                  type="button"
                  onClick={() => handlePay(sale.id)}
                >
                  Registrer betaling
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
