import { useEffect, useMemo, useState } from "react";
import type { Customer } from "../types";
import { getCustomers } from "../app/storage";
import NewCustomerModal from "./NewCustomerModal";

type Props = {
  value?: string;
  onChange: (customer: Customer | undefined) => void;
  placeholder?: string;
};

export default function CustomerPickerWithCreate({
  value,
  onChange,
  placeholder = "Søk eller velg kunde...",
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    setCustomers(getCustomers());
  }, []);

  const selected = useMemo(
    () => customers.find((x) => x.id === value),
    [customers, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);

    return customers
      .filter((customer) => {
        return (
          customer.name.toLowerCase().includes(q) ||
          (customer.phone ?? "").toLowerCase().includes(q) ||
          (customer.address ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, query]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={openList ? query : selected?.name ?? query}
        placeholder={placeholder}
        onFocus={() => {
          setOpenList(true);
          setQuery(selected?.name ?? "");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpenList(true);
        }}
      />

      {openList && (
        <div className="dropdown">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="dropdownItem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(customer);
                setQuery(customer.name);
                setOpenList(false);
              }}
            >
              <div style={{ fontWeight: 700 }}>{customer.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {[customer.phone, customer.address].filter(Boolean).join(" • ") || "Ingen ekstra info"}
              </div>
            </button>
          ))}

          {filtered.length === 0 ? (
            <div style={{ padding: 12 }}>
              <div className="emptyState">Ingen kunder funnet</div>
              <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
                + Opprett “{query.trim() || "ny kunde"}”
              </button>
            </div>
          ) : (
            <div style={{ padding: 10 }}>
              <button className="btn" type="button" onClick={() => setOpenNew(true)}>
                + Ny kunde
              </button>
            </div>
          )}
        </div>
      )}

      <NewCustomerModal
        open={openNew}
        initialName={query}
        onClose={() => setOpenNew(false)}
        onCreated={(customer) => {
          const next = getCustomers();
          setCustomers(next);
          onChange(customer);
          setQuery(customer.name);
          setOpenList(false);
        }}
      />
    </div>
  );
}
