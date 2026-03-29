import { useEffect, useMemo, useState } from "react";
import type { InventoryItem } from "../types";
import { getItems } from "../app/storage";
import NewItemModal from "./NewItemModal";

type Props = {
  value?: string;
  onChange: (item: InventoryItem | undefined) => void;
  placeholder?: string;
};

export default function ItemPickerWithCreate({
  value,
  onChange,
  placeholder = "Søk eller velg vare...",
}: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    setItems(getItems());
  }, []);

  const selected = useMemo(
    () => items.find((x) => x.id === value),
    [items, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 20);

    return items
      .filter((item) => {
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [items, query]);

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
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="dropdownItem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(item);
                setQuery(item.name);
                setOpenList(false);
              }}
            >
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Lager: {item.stock} • Salg: {item.salePrice} • Kost: {item.costPrice}
              </div>
            </button>
          ))}

          {filtered.length === 0 ? (
            <div style={{ padding: 12 }}>
              <div className="emptyState">Ingen varer funnet</div>
              <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
                + Opprett “{query.trim() || "ny vare"}”
              </button>
            </div>
          ) : (
            <div style={{ padding: 10 }}>
              <button className="btn" type="button" onClick={() => setOpenNew(true)}>
                + Ny vare
              </button>
            </div>
          )}
        </div>
      )}

      <NewItemModal
        open={openNew}
        initialName={query}
        onClose={() => setOpenNew(false)}
        onCreated={(item) => {
          const next = getItems();
          setItems(next);
          onChange(item);
          setQuery(item.name);
          setOpenList(false);
        }}
      />
    </div>
  );
}
