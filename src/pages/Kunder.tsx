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
      <h1 className="pageTitle">Kunder</h1>
      <p className="pageLead">Oversikt over kunder, kjøp og utestående.</p>

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
          <h2 className="sectionTitle">Kundeliste</h2>

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
                      <div>
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
                <div>
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
                        <div>
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
