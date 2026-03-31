import { useEffect, useMemo, useRef, useState } from "react";
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomers(getCustomers());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpenList(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpenList(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
          (customer.address ?? "").toLowerCase().includes(q) ||
          (customer.note ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, query]);

  const shownValue = openList ? query : selected?.name ?? query;

  return (
    <div className="picker" ref={wrapRef}>
      <input
        className="pickerInput"
        value={shownValue}
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

      {openList ? (
        <div className="pickerDropdown">
          <div className="pickerList">
            {filtered.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="pickerItem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(customer);
                  setQuery(customer.name);
                  setOpenList(false);
                }}
              >
                <div className="pickerItemTitle">{customer.name}</div>
                <div className="pickerItemMeta">
                  {[customer.phone, customer.address].filter(Boolean).join(" • ") || "Ingen ekstra info"}
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <>
              <div className="pickerHint">Ingen kunder funnet.</div>
              <div className="pickerFooter">
                <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
                  + Opprett “{query.trim() || "ny kunde"}”
                </button>
              </div>
            </>
          ) : (
            <div className="pickerFooter">
              <button className="btn" type="button" onClick={() => setOpenNew(true)}>
                + Ny kunde
              </button>

              {selected ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    onChange(undefined);
                    setQuery("");
                    setOpenList(false);
                  }}
                >
                  Tøm valg
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <NewCustomerModal
        open={openNew}
        initialName={query}
        onClose={() => setOpenNew(false)}
        onCreated={(customer: Customer) => {
          const next = getCustomers();
          setCustomers(next);
          onChange(customer);
          setQuery(customer.name);
          setOpenList(false);
          setOpenNew(false);
        }}
      />
    </div>
  );
}
