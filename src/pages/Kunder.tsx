import { useEffect, useMemo, useState } from "react";
import NewCustomerModal from "../components/NewCustomerModal";
import {
  customerDebtRemaining,
  customerDebts,
  customerSales,
  customerTotalBought,
  customerTotalRemaining,
  debtRemaining,
  deleteCustomer,
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
  const [openNew, setOpenNew] = useState(false);

  function refresh(): void {
    const all = getCustomers();
    setCustomers(all);

    if (!selectedId && all.length > 0) {
      const sorted = [...all].sort((a, b) => {
        const aTotal = customerTotalRemaining(a.id) + customerDebtRemaining(a.id);
        const bTotal = customerTotalRemaining(b.id) + customerDebtRemaining(b.id);
        return bTotal - aTotal;
      });
      setSelectedId(sorted[0]?.id ?? "");
      return;
    }

    if (selectedId && !all.some((x) => x.id === selectedId)) {
      setSelectedId(all[0]?.id ?? "");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();

    let base = [...customers].sort((a, b) => {
      const aTotal = customerTotalRemaining(a.id) + customerDebtRemaining(a.id);
      const bTotal = customerTotalRemaining(b.id) + customerDebtRemaining(b.id);
      return bTotal - aTotal;
    });

    if (filterMode === "skyldig") {
      base = base.filter(
        (customer) =>
          customerTotalRemaining(customer.id) > 0 || customerDebtRemaining(customer.id) > 0
      );
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

  const selectedDebts = useMemo(() => {
    if (!selectedCustomer) return [];
    return customerDebts(selectedCustomer.id);
  }, [selectedCustomer]);

  const totalCustomers = customers.length;
  const customersWithOpen = customers.filter(
    (customer) =>
      customerTotalRemaining(customer.id) > 0 || customerDebtRemaining(customer.id) > 0
  ).length;
  const totalOutstanding = customers.reduce(
    (sum, customer) =>
      sum + customerTotalRemaining(customer.id) + customerDebtRemaining(customer.id),
    0
  );

  function handleDeleteSelected(): void {
    if (!selectedCustomer) return;

    const ok = confirm(`Slette kunden "${selectedCustomer.name}"?`);
    if (!ok) return;

    try {
      deleteCustomer(selectedCustomer.id);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Kunne ikke slette kunden");
    }
  }

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="pageTitle">Kunder</h1>
          <p className="pageLead">Viser åpne beløp først, både salg og egen gjeld.</p>
        </div>

        <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
          + Ny kunde
        </button>
      </div>

      <div className="grid3">
        <div className="statCard">
          <div className="statLabel">Totalt kunder</div>
          <div className="statValue">{totalCustomers}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Kunder med åpne beløp</div>
          <div className="statValue">{customersWithOpen}</div>
        </div>

        <div className="statCard">
          <div className="statLabel">Totalt til gode</div>
          <div className="statValue debtText">{fmtKr(totalOutstanding)}</div>
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
                Åpne beløp
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
                const salesOpen = customerTotalRemaining(customer.id);
                const debtOpen = customerDebtRemaining(customer.id);
                const totalOpen = salesOpen + debtOpen;
                const isSelected = selectedId === customer.id;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    className={
                      isSelected
                        ? totalOpen > 0
                          ? "customerButton active customerButtonDebt"
                          : "customerButton active"
                        : totalOpen > 0
                        ? "customerButton customerButtonDebt"
                        : "customerButton"
                    }
                  >
                    <div className="customerButtonTop">
                      <div className="customerMain">
                        <div className="customerName">{customer.name}</div>
                        <div className="customerMeta">
                          {customer.phone || customer.address || "Ingen ekstra info"}
                        </div>
                        {totalOpen > 0 ? (
                          <div className="featureRowSub" style={{ marginTop: 6 }}>
                            Salg: {fmtKr(salesOpen)} • Gjeld: {fmtKr(debtOpen)}
                          </div>
                        ) : null}
                      </div>

                      <div className={totalOpen > 0 ? "badge badgeDebt" : "badge"}>
                        {fmtKr(totalOpen)}
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
                    customerTotalRemaining(selectedCustomer.id) + customerDebtRemaining(selectedCustomer.id) > 0
                      ? "badge badgeDebt"
                      : "badge badgeSuccess"
                  }
                >
                  {customerTotalRemaining(selectedCustomer.id) + customerDebtRemaining(selectedCustomer.id) > 0
                    ? "Åpne beløp"
                    : "Ajour"}
                </div>
              </div>

              <div className="grid3" style={{ marginBottom: 18 }}>
                <div className="infoCard">
                  <div className="infoLabel">Totalt kjøpt</div>
                  <div className="infoValue">{fmtKr(customerTotalBought(selectedCustomer.id))}</div>
                </div>

                <div className="infoCard">
                  <div className="infoLabel">Utestående salg</div>
                  <div className="infoValue debtText">
                    {fmtKr(customerTotalRemaining(selectedCustomer.id))}
                  </div>
                </div>

                <div className="infoCard">
                  <div className="infoLabel">Gjeld / lån</div>
                  <div className="infoValue debtText">
                    {fmtKr(customerDebtRemaining(selectedCustomer.id))}
                  </div>
                </div>
              </div>

              {selectedCustomer.note ? (
                <div className="infoCard" style={{ marginBottom: 18 }}>
                  <div className="infoLabel">Notat</div>
                  <div>{selectedCustomer.note}</div>
                </div>
              ) : null}

              <div className="cardActions" style={{ marginTop: 0, marginBottom: 18 }}>
                <button className="btn btnDanger" type="button" onClick={handleDeleteSelected}>
                  Slett kunde
                </button>
              </div>

              <h3 className="sectionTitle">Utestående fra salg</h3>

              <div className="historyList" style={{ marginBottom: 18 }}>
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

              <h3 className="sectionTitle">Gjeld / lån</h3>

              <div className="historyList">
                {selectedDebts.length === 0 ? (
                  <div className="emptyText">Ingen gjeldsposter på denne kunden.</div>
                ) : (
                  selectedDebts.map((debt) => (
                    <div key={debt.id} className="infoCard">
                      <div className="rowBetween">
                        <div className="customerMain">
                          <div style={{ fontWeight: 700 }}>{debt.title}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            {new Date(debt.createdAt).toLocaleString("no-NO")} • Rest: {fmtKr(debtRemaining(debt))}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800 }}>{fmtKr(debt.total)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            {debt.note || "Ingen notat"}
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

      <NewCustomerModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}
