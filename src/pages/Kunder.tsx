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

export default function Kunder() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const all = getCustomers();
    setCustomers(all);

    const sorted = [...all].sort(
      (a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id)
    );

    setSelectedId(sorted[0]?.id ?? "");
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return [...customers]
      .sort((a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id))
      .filter((customer) => {
        if (!q) return true;

        return (
          customer.name.toLowerCase().includes(q) ||
          (customer.phone ?? "").toLowerCase().includes(q) ||
          (customer.address ?? "").toLowerCase().includes(q) ||
          (customer.note ?? "").toLowerCase().includes(q)
        );
      });
  }, [customers, query]);

  const selectedCustomer = useMemo(() => {
    return (
      filteredCustomers.find((customer) => customer.id === selectedId) ||
      customers.find((customer) => customer.id === selectedId) ||
      null
    );
  }, [filteredCustomers, customers, selectedId]);

  const selectedSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return customerSales(selectedCustomer.id);
  }, [selectedCustomer]);

  const totalCustomers = customers.length;
  const customersWithDebt = customers.filter(
    (customer) => customerTotalRemaining(customer.id) > 0
  ).length;
  const totalOutstanding = customers.reduce(
    (sum, customer) => sum + customerTotalRemaining(customer.id),
    0
  );

  return (
    <div>
      <h1 style={{ fontSize: 44, marginBottom: 8 }}>Kunder</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: "#94a3b8" }}>
        Oversikt over kunder, kjøp og utestående.
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
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt kunder</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{totalCustomers}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Kunder med utestående</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{customersWithDebt}</div>
        </div>

        <div className="card">
          <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt utestående</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{fmtKr(totalOutstanding)}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(300px, 420px) minmax(0, 1fr)",
        }}
      >
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Kundeliste</h2>

          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk kunde, telefon, adresse..."
            />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>Ingen kunder funnet.</div>
            ) : (
              filteredCustomers.map((customer) => {
                const outstanding = customerTotalRemaining(customer.id);
                const isSelected = selectedId === customer.id;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    style={{
                      textAlign: "left",
                      background: isSelected
                        ? "rgba(59,130,246,0.16)"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected
                        ? "1px solid rgba(59,130,246,0.65)"
                        : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: 14,
                      color: "#e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{customer.name}</div>
                        <div style={{ color: "#94a3b8", marginTop: 6 }}>
                          {customer.phone || customer.address || "Ingen ekstra info"}
                        </div>
                      </div>

                      <div
                        style={{
                          whiteSpace: "nowrap",
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: "1px solid rgba(245,158,11,0.25)",
                          background:
                            outstanding > 0
                              ? "rgba(245,158,11,0.15)"
                              : "rgba(255,255,255,0.05)",
                          color: outstanding > 0 ? "#f8d29a" : "#e5e7eb",
                        }}
                      >
                        {fmtKr(outstanding)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          {!selectedCustomer ? (
            <div style={{ color: "#94a3b8" }}>Velg en kunde.</div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: 18,
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 8 }}>{selectedCustomer.name}</h2>
                  <div style={{ color: "#94a3b8" }}>
                    {selectedCustomer.phone ||
                      selectedCustomer.address ||
                      "Ingen kontaktinfo lagt inn"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border:
                      customerTotalRemaining(selectedCustomer.id) > 0
                        ? "1px solid rgba(245,158,11,0.25)"
                        : "1px solid rgba(34,197,94,0.25)",
                    background:
                      customerTotalRemaining(selectedCustomer.id) > 0
                        ? "rgba(245,158,11,0.15)"
                        : "rgba(34,197,94,0.12)",
                  }}
                >
                  {customerTotalRemaining(selectedCustomer.id) > 0
                    ? "Utestående"
                    : "Ajour"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ color: "#94a3b8", marginBottom: 8 }}>Totalt kjøpt</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>
                    {fmtKr(customerTotalBought(selectedCustomer.id))}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ color: "#94a3b8", marginBottom: 8 }}>Utestående</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>
                    {fmtKr(customerTotalRemaining(selectedCustomer.id))}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ color: "#94a3b8", marginBottom: 8 }}>Antall salg</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{selectedSales.length}</div>
                </div>
              </div>

              {selectedCustomer.note ? (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ color: "#94a3b8", marginBottom: 8 }}>Notat</div>
                  <div>{selectedCustomer.note}</div>
                </div>
              ) : null}

              <h3 style={{ marginTop: 0 }}>Historikk</h3>

              <div style={{ display: "grid", gap: 10 }}>
                {selectedSales.length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>Ingen salg på denne kunden enda.</div>
                ) : (
                  selectedSales.map((sale) => (
                    <div
                      key={sale.id}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {new Date(sale.createdAt).toLocaleString("no-NO")}
                          </div>
                          <div style={{ color: "#94a3b8", marginTop: 6 }}>
                            Betalt: {fmtKr(salePaidSum(sale))} • Rest: {fmtKr(saleRemaining(sale))}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800 }}>{fmtKr(sale.total)}</div>
                          <div style={{ color: "#94a3b8", marginTop: 6 }}>
                            {sale.lines.length} linjer
                          </div>
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
