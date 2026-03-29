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

type FilterMode = "skyldig" | "alle";

export default function Kunder() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("skyldig");

  useEffect(() => {
    const all = getCustomers();
    setCustomers(all);

    const sorted = [...all].sort(
      (a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id)
    );

    const firstWithDebt = sorted.find((x) => customerTotalRemaining(x.id) > 0);
    setSelectedId(firstWithDebt?.id ?? sorted[0]?.id ?? "");
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();

    let base = [...customers].sort(
      (a, b) => customerTotalRemaining(b.id) - customerTotalRemaining(a.id)
    );

    if (filterMode === "skyldig") {
      base = base.filter((customer) => customerTotalRemaining(customer.id) > 0);
    }

    return base.filter((customer) => {
      if (!q) return true;

      return (
        customer.name.toLowerCase().includes(q) ||
        (customer.phone ?? "").toLowerCase().includes(q) ||
        (customer.address ?? "").toLowerCase().includes(q) ||
        (customer.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, query, filterMode]);

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
      <h1 className="pageTitle">Kunder</h1>
      <p className="pageLead">Viser skyldige kunder først, så du slipper rot.</p>

      <div className="grid3">
        <div className="statCard">
          <div className="statLabel">Totalt kunder</div>
          <div className="statValue">{totalCustomers}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Kunder med utestående</div>
          <div className="statValue">{customersWithDebt}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Totalt utestående</div>
          <div className="statValue">{fmtKr(totalOutstanding)}</div>
        </div>
      </div>

      <div className="splitLayout" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="rowBetween" style={{ marginBottom: 14 }}>
            <h2 className="sectionTitle" style={{ marginBottom: 0 }}>Kundeliste</h2>

            <div className="rowBetween" style={{ gap: 8 }}>
              <button
                type="button"
                className={filterMode === "skyldig" ? "btn btnPrimary" : "btn"}
                onClick={() => setFilterMode("skyldig")}
              >
                Skyldig
              </button>
              <button
                type="button"
                className={filterMode === "alle" ? "btn btnPrimary" : "btn"}
                onClick={() => setFilterMode("alle")}
              >
                Alle
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk kunde, telefon, adresse..."
            />
          </div>

          <div className="customerList">
            {filteredCustomers.length === 0 ? (
              <div className="emptyText">Ingen kunder funnet.</div>
            ) : (
              filteredCustomers.map((customer) => {
                const outstanding = customerTotalRemaining(customer.id);
                const isSelected = selectedId === customer.id;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    className={isSelected ? "customerButton active" : "customerButton"}
                  >
                    <div className="customerButtonTop">
                      <div className="customerMain">
                        <div className="customerName">{customer.name}</div>
                        <div className="customerMeta">
                          {customer.phone || customer.address || "Ingen ekstra info"}
                        </div>
                      </div>

                      <div className={outstanding > 0 ? "badge badgeGold" : "badge"}>
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
            <div className="emptyText">Velg en kunde.</div>
          ) : (
            <>
              <div className="rowBetween" style={{ marginBottom: 18 }}>
                <div className="customerMain">
                  <h2 className="sectionTitle" style={{ marginBottom: 8 }}>
                    {selectedCustomer.name}
                  </h2>
                  <div className="muted">
                    {selectedCustomer.phone ||
                      selectedCustomer.address ||
                      "Ingen kontaktinfo lagt inn"}
                  </div>
                </div>

                <div
                  className={
                    customerTotalRemaining(selectedCustomer.id) > 0
                      ? "badge badgeGold"
                      : "badge badgeSuccess"
                  }
                >
                  {customerTotalRemaining(selectedCustomer.id) > 0 ? "Utestående" : "Ajour"}
                </div>
              </div>

              <div className="grid3" style={{ marginBottom: 18 }}>
                <div className="infoCard">
                  <div className="infoLabel">Totalt kjøpt</div>
                  <div className="infoValue">
                    {fmtKr(customerTotalBought(selectedCustomer.id))}
                  </div>
                </div>

                <div className="infoCard">
                  <div className="infoLabel">Utestående</div>
                  <div className="infoValue">
                    {fmtKr(customerTotalRemaining(selectedCustomer.id))}
                  </div>
                </div>

                <div className="infoCard">
                  <div className="infoLabel">Antall salg</div>
                  <div className="infoValue">{selectedSales.length}</div>
                </div>
              </div>

              {selectedCustomer.note ? (
                <div className="infoCard" style={{ marginBottom: 18 }}>
                  <div className="infoLabel">Notat</div>
                  <div>{selectedCustomer.note}</div>
                </div>
              ) : null}

              <h3 className="sectionTitle">Historikk</h3>

              <div className="historyList">
                {selectedSales.length === 0 ? (
                  <div className="emptyText">Ingen salg på denne kunden enda.</div>
                ) : (
                  selectedSales.map((sale) => (
                    <div key={sale.id} className="infoCard">
                      <div className="rowBetween">
                        <div className="customerMain">
                          <div style={{ fontWeight: 700 }}>
                            {new Date(sale.createdAt).toLocaleString("no-NO")}
                          </div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            Betalt: {fmtKr(salePaidSum(sale))} • Rest: {fmtKr(saleRemaining(sale))}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800 }}>{fmtKr(sale.total)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
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
