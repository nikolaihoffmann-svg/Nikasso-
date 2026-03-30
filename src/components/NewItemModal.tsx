import { useEffect, useState } from "react";
import type { InventoryItem, ItemCategory } from "../types";
import { createItem, updateItem } from "../app/storage";

type Props = {
  open: boolean;
  initialName?: string;
  item?: InventoryItem | null;
  onClose: () => void;
  onCreated: (item: InventoryItem) => void;
};

const categories: ItemCategory[] = ["Deler", "Forbruk", "Utstyr", "Annet"];

export default function NewItemModal({
  open,
  initialName = "",
  item = null,
  onClose,
  onCreated,
}: Props) {
  const isEdit = Boolean(item);

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ItemCategory>("Annet");
  const [salePrice, setSalePrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (item) {
      setName(item.name);
      setCategory(item.category);
      setSalePrice(String(item.salePrice ?? 0));
      setCostPrice(String(item.costPrice ?? 0));
      setStock(String(item.stock ?? 0));
      setMinStock(String(item.minStock ?? 0));
      setNote(item.note ?? "");
      setError("");
      return;
    }

    setName(initialName || "");
    setCategory("Annet");
    setSalePrice("0");
    setCostPrice("0");
    setStock("0");
    setMinStock("0");
    setNote("");
    setError("");
  }, [open, initialName, item]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSave(): void {
    try {
      if (item) {
        const updated = updateItem(item.id, {
          name,
          category,
          unit: "stk",
          salePrice: Number(salePrice || 0),
          costPrice: Number(costPrice || 0),
          stock: Number(stock || 0),
          minStock: Number(minStock || 0),
          note,
        });
        onCreated(updated);
      } else {
        const created = createItem({
          name,
          category,
          unit: "stk",
          salePrice: Number(salePrice || 0),
          costPrice: Number(costPrice || 0),
          stock: Number(stock || 0),
          minStock: Number(minStock || 0),
          note,
        });
        onCreated(created);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre vare");
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Rediger vare" : "Ny vare"}
      >
        <div className="rowBetween modalHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>
              {isEdit ? "Rediger vare" : "Ny vare"}
            </h2>
            <div className="muted">
              {isEdit
                ? "Oppdater navn, priser, lager og notat."
                : "Opprett vare for lager, salg og innkjøp."}
            </div>
          </div>

          <button className="btn" type="button" onClick={onClose}>
            Lukk
          </button>
        </div>

        <div className="grid2">
          <label className="label">
            <span>Varenavn</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Bremseklosser"
            />
          </label>

          <label className="label">
            <span>Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
              {categories.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            <span>Enhet</span>
            <input value="stk" disabled />
          </label>

          <label className="label">
            <span>Salgspris</span>
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </label>

          <label className="label">
            <span>Kostpris</span>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </label>

          <label className="label">
            <span>Lager</span>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>

          <label className="label">
            <span>Min. lager</span>
            <input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </label>
        </div>

        <label className="label" style={{ marginTop: 14 }}>
          <span>Notat</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Valgfritt notat..."
          />
        </label>

        {error ? <div className="modalError">{error}</div> : null}

        <div className="cardActions">
          <div className="muted">
            {isEdit
              ? "Endringer lagres direkte på varen."
              : "Varen kan også opprettes direkte fra salg og innkjøp."}
          </div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            {isEdit ? "Lagre endringer" : "Lagre vare"}
          </button>
        </div>
      </div>
    </div>
  );
}
