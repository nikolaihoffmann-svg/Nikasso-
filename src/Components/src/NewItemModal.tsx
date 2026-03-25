import { useMemo, useState } from "react";
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

export default function NewItemModal({ open, initialName = "", onClose, onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<ItemCategory>("Deler");
  const [unit, setUnit] = useState<ItemUnit>("stk");
  const [salePrice, setSalePrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [error, setError] = useState("");

  useMemo(() => {
    if (open) {
      setName(initialName || "");
      setSku("");
      setCategory("Deler");
      setUnit("stk");
      setSalePrice("0");
      setCostPrice("0");
      setStock("0");
      setMinStock("0");
      setError("");
    }
  }, [open, initialName]);

  if (!open) return null;

  function handleSave() {
    try {
      const item = createItem({
        name,
        sku,
        category,
        unit,
        salePrice: Number(salePrice || 0),
        costPrice: Number(costPrice || 0),
        stock: Number(stock || 0),
        minStock: Number(minStock || 0),
      });
      onCreated(item);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette vare");
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Ny vare</h2>
          <button style={closeButtonStyle} onClick={onClose}>×</button>
        </div>

        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Varenavn</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Bremseklosser bak" />
          </label>

          <label style={fieldStyle}>
            <span>Varenr / SKU</span>
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Valgfritt" />
          </label>

          <label style={fieldStyle}>
            <span>Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
              {categories.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Enhet</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit)}>
              {units.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Salgspris</span>
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </label>

          <label style={fieldStyle}>
            <span>Kostpris</span>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </label>

          <label style={fieldStyle}>
            <span>Lager</span>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>

          <label style={fieldStyle}>
            <span>Min. lager</span>
            <input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </label>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={footerStyle}>
          <button style={secondaryButtonStyle} onClick={onClose}>Avbryt</button>
          <button style={primaryButtonStyle} onClick={handleSave}>Lagre vare</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  background: "#0f172a",
  color: "#fff",
  borderRadius: 20,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.08)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
};

const closeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "#fff",
  fontSize: 24,
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 20,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: 0,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#fca5a5",
};
