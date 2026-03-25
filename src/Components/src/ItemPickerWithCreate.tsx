import { useEffect, useMemo, useState } from "react";
import type { InventoryItem } from "../types";
import { getItems } from "../app/storage";
import NewItemModal from "./NewItemModal";

type Props = {
  value?: string;
  placeholder?: string;
  onChange: (item: InventoryItem | undefined) => void;
};

export default function ItemPickerWithCreate({
  value,
  placeholder = "Søk eller velg vare...",
  onChange,
}: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const [openNewModal, setOpenNewModal] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setItems(getItems());
  }

  const selectedItem = useMemo(() => {
    return items.find((x) => x.id === value);
  }, [items, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 20);

    return items
      .filter((item) => {
        return (
          item.name.toLowerCase().includes(q) ||
          (item.sku ?? "").toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [items, query]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={openList ? query : selectedItem?.name ?? query}
        placeholder={placeholder}
        onFocus={() => {
          setOpenList(true);
          setQuery(selectedItem?.name ?? "");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpenList(true);
        }}
        style={inputStyle}
      />

      {openList && (
        <div style={dropdownStyle}>
          {filtered.map((item) => (
            <button
              key={item.id}
              style={optionStyle}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(item);
                setQuery(item.name);
                setOpenList(false);
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Lager: {item.stock} • Kost: {item.costPrice} • Salg: {item.salePrice}
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 10 }}>
              <div style={{ opacity: 0.75, marginBottom: 8 }}>Ingen varer funnet</div>
              <button
                style={createButtonStyle}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpenNewModal(true)}
              >
                + Opprett “{query.trim() || "ny vare"}”
              </button>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 8 }}>
              <button
                style={createButtonStyle}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpenNewModal(true)}
              >
                + Ny vare
              </button>
            </div>
          )}
        </div>
      )}

      <NewItemModal
        open={openNewModal}
        initialName={query}
        onClose={() => setOpenNewModal(false)}
        onCreated={(item) => {
          refresh();
          onChange(item);
          setQuery(item.name);
          setOpenList(false);
        }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  overflow: "hidden",
  zIndex: 50,
  maxHeight: 320,
  overflowY: "auto",
};

const optionStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 12,
  background: "transparent",
  color: "#fff",
  border: 0,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  cursor: "pointer",
};

const createButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  cursor: "pointer",
};
