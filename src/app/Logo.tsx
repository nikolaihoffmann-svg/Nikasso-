import { useEffect, useMemo, useState } from "react";
import {
  customerSales,
  customerTotalBought,
  customerTotalRemaining,
  fmtKr,
  getCustomers,
  salePaidSum,
  saleRemaining,
} from "../app/storage";
import type { Customer } from "../types";

type ViewMode = "skyldig" | "alle";

export default function Kunder() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("skyldig");

  useEffect(() => {
    const all = getCustomers();
    setCustomers(all);

    const sortedByDebt = [...all].sort(
      (a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id)
    );

    const firstWithDebt = sortedByDebt.find((c) => customerTotalRemaining(c.id) > 0);
    setSelectedId(firstWithDebt?.id ?? sortedByDebt[0]?.id ?? "");
  }, []);

  const filteredCustomers = useMemo(() => {
    let base = [...customers].sort(
      (a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id)
    );

    if (viewMode === "skyldig") {
      base = base.filter((customer) => customerTotalRemaining(customer.id) > 0);
    }

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(q) ||
        (customer.phone ?? "").toLowerCase().includes(q) ||
        (customer.address ?? "").toLowerCase().includes(q) ||
        (customer.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, query, viewMode]);

  const selected = useMemo(
    () =>
      filteredCustomers.find((x) => x.id === selectedId) ||
      customers.find((x) => x.id === selectedId),
    [filteredCustomers, customers, selectedId]
  );

  const sales = useMemo(
    () => (selected ? customerSales(selected.id) : []),
    [selected]
  );

  const customerCountWithDebt = useMemo(
    () => customers.filter((c) => customerTotalRemaining(c.id) > 0).length,
    [customers]
  );

  const totalDebt = useMemo(
    () => customers.reduce((sum, c) => sum + customerTotalRemaining(c.id), 0),
    [customers]
  );

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="pageTitle" style={{ marginBottom: 6 }}>Kunder</h1>
          <div className="muted">Fokus på de som faktisk skylder penger først</div>
        </div>
      </div>

      <div className="kpiGrid" style={{ marginBottom: 16 }}>
        <div className="kpiCard">
          <div className="kpiLabel">Totalt kunder</div>
          <div className="kpiValue">{customers.length}</div>
        </div>
        <div className="kpiCard">
          <div className="kpiLabel">Kunder med utestående</div>
          <div className="kpiValue">{customerCountWithDebt}</div>
        </div>
        <div className="kpiCard">
          <div className="kpiLabel">Totalt utestående</div>
          <div className="kpiValue">{fmtKr(totalDebt)}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="rowBetween" style={{ marginBottom: 14 }}>
            <h2 className="sectionTitle" style={{ margin: 0 }}>Kundeliste</h2>
            <span className="badge badgeBlue">{filteredCustomers.length} vises</span>
          </div>

          <div className="filterBar" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`filterChip ${viewMode === "skyldig" ? "filterChipActive" : ""}`}
              onClick={() => setViewMode("skyldig")}
            >
              Skyldig
            </button>
            <button
              type="button"
              className={`filterChip ${viewMode === "alle" ? "filterChipActive" : ""}`}
              onClick={() => setViewMode("alle")}
            >
              Alle
            </button>
          </div>

          <label className="label" style={{ marginBottom: 14 }}>
            <span>Søk kunde</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Navn, telefon, adresse..."
            />
          </label>

          <div className="compactList">
            {filteredCustomers.length === 0 ? (
              <div className="emptyState">
                {viewMode === "skyldig" ? "Ingen kunder med utestående." : "Ingen kunder funnet."}
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const remaining = customerTotalRemaining(customer.id);
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={`compactRow ${selectedId === customer.id ? "compactRowActive" : ""}`}
                    style={{ textAlign: "left", color: "inherit" }}
                    onClick={() => setSelectedId(customer.id)}
                  >
                    <div className="rowBetween">
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{customer.name}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {customer.phone || customer.address || "Ingen ekstra info"}
                        </div>
                      </div>

                      <span className={remaining > 0 ? "badge badgeGold" : "badge"}>
                        {fmtKr(remaining)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          {!selected ? (
            <div className="emptyState">Velg en kunde.</div>
          ) : (
            <>
              <div className="rowBetween" style={{ marginBottom: 12 }}>
                <div>
                  <h2 className="sectionTitle" style={{ margin: 0 }}>{selected.name}</h2>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {selected.phone || selected.address || "Ingen kontaktinfo lagt inn"}
                  </div>
                </div>

                <span className={customerTotalRemaining(selected.id) > 0 ? "badge badgeGold" : "badge badgeSuccess"}>
                  {customerTotalRemaining(selected.id) > 0 ? "Utestående" : "A jour"}
                </span>
              </div>

              <div className="kpiGrid" style={{ marginBottom: 16 }}>
                <div className="kpiCard">
                  <div className="kpiLabel">Totalt kjøpt</div>
                  <div className="kpiValue">{fmtKr(customerTotalBought(selected.id))}</div>
                </div>
                <div className="kpiCard">
                  <div className="kpiLabel">Utestående</div>
                  <div className="kpiValue">{fmtKr(customerTotalRemaining(selected.id))}</div>
                </div>
                <div className="kpiCard">
                  <div className="kpiLabel">Antall salg</div>
                  <div className="kpiValue">{sales.length}</div>
                </div>
              </div>

              {selected.note ? (
                <div className="compactRow" style={{ marginBottom: 16 }}>
                  <div className="kpiLabel">Notat</div>
                  <div>{selected.note}</div>
                </div>
              ) : null}

              <h3 className="sectionTitle">Historikk</h3>
              <div className="compactList">
                {sales.length === 0 ? (
                  <div className="emptyState">Ingen salg på denne kunden enda.</div>
                ) : (
                  sales.slice(0, 8).map((sale) => (
                    <div key={sale.id} className="compactRow">
                      <div className="rowBetween">
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {new Date(sale.createdAt).toLocaleString("no-NO")}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            Betalt: {fmtKr(salePaidSum(sale))} • Rest: {fmtKr(saleRemaining(sale))}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800 }}>{fmtKr(sale.total)}</div>
                          <div className="muted">{sale.lines.length} linjer</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
