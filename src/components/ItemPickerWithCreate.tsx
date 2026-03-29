import { useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItem } from "../types";
import { fmtKr, getItems } from "../app/storage";
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems(getItems());
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
          item.category.toLowerCase().includes(q) ||
          (item.note ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [items, query]);

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
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="pickerItem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setQuery(item.name);
                  setOpenList(false);
                }}
              >
                <div className="pickerItemTitle">{item.name}</div>
                <div className="pickerItemMeta">
                  Lager: {item.stock} • Salg: {fmtKr(item.salePrice)} • Kost: {fmtKr(item.costPrice)}
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <>
              <div className="pickerHint">Ingen varer funnet.</div>
              <div className="pickerFooter">
                <button className="btn btnPrimary" type="button" onClick={() => setOpenNew(true)}>
                  + Opprett “{query.trim() || "ny vare"}”
                </button>
              </div>
            </>
          ) : (
            <div className="pickerFooter">
              <button className="btn" type="button" onClick={() => setOpenNew(true)}>
                + Ny vare
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
