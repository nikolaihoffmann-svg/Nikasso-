import { useEffect, useMemo, useState } from "react";
import { addPaymentToSale, fmtKr, getSales, saleRemaining } from "../app/storage";
import type { SaleRecord } from "../types";

type FilterKey = "all" | "big" | "small";

export default function Gjeld() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  function refresh(): void {
    setSales(getSales());
  }

  useEffect(() => {
    refresh();
  }, []);

  const receivables = useMemo(() => {
    const all = sales
      .map((sale) => ({
        sale,
        remaining: saleRemaining(sale),
      }))
      .filter((x) => x.remaining > 0);

    let filtered = all;

    if (filter === "big") {
      filtered = filtered.filter((x) => x.remaining >= 1000);
    }

    if (filter === "small") {
      filtered = filtered.filter((x) => x.remaining < 1000);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((x) =>
        (x.sale.customerName || "kontantsalg").toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => b.remaining - a.remaining);
  }, [sales, filter, search]);

  const totalOpen = useMemo(
    () => receivables.reduce((sum, x) => sum + x.remaining, 0),
    [receivables]
  );

  function handlePay(saleId: string): void {
    const amount = Number(amounts[saleId] || 0);
    if (amount <= 0) return;
    addPaymentToSale(saleId, amount, "Registrert fra Gjeld");
    setAmounts((prev) => ({ ...prev, [saleId]: "" }));
    refresh();
  }

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="pageTitle" style={{ marginBottom: 6 }}>Gjeld</h1>
          <div className="muted">Ryddig oversikt over åpne poster og raske betalinger</div>
        </div>
        <span className="badge badgeGold">Totalt: {fmtKr(totalOpen)}</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="rowBetween" style={{ marginBottom: 14 }}>
          <label className="label" style={{ flex: 1, minWidth: 220 }}>
            <span>Søk kunde</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Navn..."
            />
          </label>
        </div>

        <div className="filterBar">
          <button
            type="button"
            className={`filterChip ${filter === "all" ? "filterChipActive" : ""}`}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            type="button"
            className={`filterChip ${filter === "big" ? "filterChipActive" : ""}`}
            onClick={() => setFilter("big")}
          >
            1000 kr+
          </button>
          <button
            type="button"
            className={`filterChip ${filter === "small" ? "filterChipActive" : ""}`}
            onClick={() => setFilter("small")}
          >
            Under 1000 kr
          </button>
        </div>
      </div>

      <div className="compactList">
        {receivables.length === 0 ? (
          <div className="card">
            <div className="emptyState">Ingen åpne poster.</div>
          </div>
        ) : (
          receivables.map(({ sale, remaining }) => (
            <div key={sale.id} className="card" style={{ padding: 16 }}>
              <div className="rowBetween" style={{ marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>
                    {sale.customerName || "Kontantsalg"}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {new Date(sale.createdAt).toLocaleString("no-NO")}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: 22 }}>{fmtKr(remaining)}</div>
                  <div className="muted">Total: {fmtKr(sale.total)}</div>
                </div>
              </div>

              <div className="grid2" style={{ alignItems: "end" }}>
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

                <button
                  className="btn btnSuccess"
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
