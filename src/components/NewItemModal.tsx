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

function parseNoNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatInputNumber(value: number | undefined): string {
  if (!value) return "";
  return String(value).replace(".", ",");
}

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
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setName(item?.name ?? initialName ?? "");
    setCategory(item?.category ?? "Annet");
    setSalePrice(formatInputNumber(item?.salePrice));
    setCostPrice(formatInputNumber(item?.costPrice));
    setStock(formatInputNumber(item?.stock));
    setMinStock(formatInputNumber(item?.minStock));
    setNote(item?.note ?? "");
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
      const saved = item
        ? updateItem(item.id, {
            name,
            category,
            unit: "stk",
            salePrice: parseNoNumber(salePrice),
            costPrice: parseNoNumber(costPrice),
            stock: parseNoNumber(stock),
            minStock: parseNoNumber(minStock),
            note,
          })
        : createItem({
            name,
            category,
            unit: "stk",
            salePrice: parseNoNumber(salePrice),
            costPrice: parseNoNumber(costPrice),
            stock: parseNoNumber(stock),
            minStock: parseNoNumber(minStock),
            note,
          });

      onCreated(saved);
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
                ? "Endre varedata, lager og priser."
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
            <span>Salgspris</span>
            <input
              type="text"
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="F.eks. 199,90"
            />
          </label>

          <label className="label">
            <span>Kostpris</span>
            <input
              type="text"
              inputMode="decimal"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="F.eks. 133,33"
            />
          </label>

          <label className="label">
            <span>Lager</span>
            <input
              type="text"
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="F.eks. 5"
            />
          </label>

          <label className="label">
            <span>Min. lager</span>
            <input
              type="text"
              inputMode="decimal"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="F.eks. 2"
            />
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
          <div className="muted">Tallfelt er gjort enklere å bruke på iPhone, og enhet er låst til stk.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            {isEdit ? "Lagre endringer" : "Lagre vare"}
          </button>
        </div>
      </div>
    </div>
  );
}
