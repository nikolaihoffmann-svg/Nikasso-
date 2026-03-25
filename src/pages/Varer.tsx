import { useEffect, useState } from "react";
import type { InventoryItem } from "../types";
import { ensureSeedItems, getItems } from "../app/storage";
import NewItemModal from "../components/NewItemModal";

export default function Varer() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [openNew, setOpenNew] = useState(false);

  function refresh(): void {
    setItems(getItems());
  }

  useEffect(() => {
    ensureSeedItems();
    refresh();
  }, []);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Varer</h1>
          <p style={{ opacity: 0.75 }}>Opprett og administrer varer</p>
        </div>
        <button style={buttonStyle} onClick={() => setOpenNew(true)} type="button">
          + Ny vare
        </button>
      </div>

      <div style={cardStyle}>
        {items.length === 0 ? (
          <div>Ingen varer enda</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 14 }}>
                    {item.category} • {item.unit}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div>Lager: {item.stock}</div>
                  <div style={{ opacity: 0.7, fontSize: 14 }}>
                    Kost: {item.costPrice} • Salg: {item.salePrice}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewItemModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  color: "#fff",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 16,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: 0,
  cursor: "pointer",
};
