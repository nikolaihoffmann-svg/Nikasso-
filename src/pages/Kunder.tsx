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

  useEffect(() => {
    const all = getCustomers();
    setCustomers(all);
    setSelectedId(all[0]?.id ?? "");
  }, []);

  const selected = useMemo(
    () => customers.find((x) => x.id === selectedId),
    [customers, selectedId]
  );

  const sales = useMemo(
    () => (selected ? customerSales(selected.id) : []),
    [selected]
  );

  return (
    <div>
      <h1 className="pageTitle">Kunder</h1>

      <div className="grid2">
        <div className="card">
          <h2 className="sectionTitle">Kundeliste</h2>
          <div className="list">
            {customers.length === 0 ? (
              <div className="emptyState">Ingen kunder enda.</div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="dropdownItem"
                  style={{
                    borderRadius: 16,
                    border: selectedId === customer.id
                      ? "1px solid rgba(79,124,255,0.65)"
                      : "1px solid rgba(255,255,255,0.06)",
                    background: selectedId === customer.id
                      ? "rgba(79,124,255,0.14)"
                      : "rgba(255,255,255,0.03)",
                  }}
                  onClick={() => setSelectedId(customer.id)}
                >
                  <div style={{ fontWeight: 800 }}>{customer.name}</div>
                  <div className="muted">
                    Skylder: {fmtKr(customerTotalRemaining(customer.id))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card">
          {!selected ? (
            <div className="emptyState">Velg en kunde.</div>
          ) : (
            <>
              <div className="rowBetween">
                <h2 className="sectionTitle" style={{ marginBottom: 0 }}>{selected.name}</h2>
                <span className={customerTotalRemaining(selected.id) > 0 ? "badge badgeGold" : "badge badgeSuccess"}>
                  {customerTotalRemaining(selected.id) > 0 ? "Utestående" : "A jour"}
                </span>
              </div>

              <div className="grid2" style={{ marginTop: 14 }}>
                <div className="card" style={{ padding: 14 }}>
                  <div className="cardTitle">Totalt kjøpt</div>
                  <div className="cardValue" style={{ fontSize: 30 }}>{fmtKr(customerTotalBought(selected.id))}</div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="cardTitle">Utestående</div>
                  <div className="cardValue" style={{ fontSize: 30 }}>{fmtKr(customerTotalRemaining(selected.id))}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }} className="list">
                {selected.phone ? <div className="muted">Telefon: {selected.phone}</div> : null}
                {selected.address ? <div className="muted">Adresse: {selected.address}</div> : null}
                {selected.note ? <div className="muted">Notat: {selected.note}</div> : null}
              </div>

              <h3 className="sectionTitle" style={{ marginTop: 20 }}>Historikk</h3>
              <div className="list">
                {sales.length === 0 ? (
                  <div className="emptyState">Ingen salg på denne kunden enda.</div>
                ) : (
                  sales.map((sale) => (
                    <div key={sale.id} className="itemRow">
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {new Date(sale.createdAt).toLocaleString("no-NO")}
                        </div>
                        <div className="muted">
                          Betalt: {fmtKr(salePaidSum(sale))} • Rest: {fmtKr(saleRemaining(sale))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700 }}>{fmtKr(sale.total)}</div>
                        <div className="muted">{sale.lines.length} linjer</div>
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
