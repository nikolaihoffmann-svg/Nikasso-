import { useEffect, useState } from "react";
import type { InventoryItem, ItemCategory, ItemUnit } from "../types";
import { createItem } from "../app/storage";

type Props = {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (item: InventoryItem) => void;
};

const categories: ItemCategory[] = ["Deler", "Olje", "Forbruk", "Utstyr", "Annet"];
const units: ItemUnit[] = ["stk", "liter", "sett", "pakke", "tube", "boks"];

export default function NewItemModal({
  open,
  initialName = "",
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ItemCategory>("Annet");
  const [unit, setUnit] = useState<ItemUnit>("stk");
  const [salePrice, setSalePrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setName(initialName || "");
    setCategory("Annet");
    setUnit("stk");
    setSalePrice("0");
    setCostPrice("0");
    setStock("0");
    setMinStock("0");
    setNote("");
    setError("");
  }, [open, initialName]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
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
      const item = createItem({
        name,
        category,
        unit,
        salePrice: Number(salePrice || 0),
        costPrice: Number(costPrice || 0),
        stock: Number(stock || 0),
        minStock: Number(minStock || 0),
        note,
      });

      onCreated(item);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette vare");
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ny vare"
      >
        <div className="rowBetween modalHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Ny vare</h2>
            <div className="muted">Opprett vare for lager, salg og innkjøp.</div>
          </div>

          <button className="btn" type="button" onClick={onClose}>
            Lukk
          </button>
        </div>

        <div className="grid2">
          <label className="label">
            <span>Varenavn</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Bremseklosser" />
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
            <select value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit)}>
              {units.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
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
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Valgfritt notat..." />
        </label>

        {error ? <div className="modalError">{error}</div> : null}

        <div className="cardActions">
          <div className="muted">Varen kan også opprettes direkte fra salg og innkjøp.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre vare
          </button>
        </div>
      </div>
    </div>
  );
}
