import { useEffect, useState } from "react";
import type { Customer } from "../types";
import { createCustomer } from "../app/storage";

type Props = {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
};

export default function NewCustomerModal({
  open,
  initialName = "",
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initialName || "");
    setPhone("");
    setAddress("");
    setNote("");
    setError("");
  }, [open, initialName]);

  if (!open) return null;

  function handleSave(): void {
    try {
      const customer = createCustomer({ name, phone, address, note });
      onCreated(customer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette kunde");
    }
  }

  return (
    <div className="modalOverlay">
      <div className="modalCard">
        <div className="rowBetween" style={{ marginBottom: 16 }}>
          <h2 className="sectionTitle" style={{ margin: 0 }}>Ny kunde</h2>
          <button className="btn" type="button" onClick={onClose}>Lukk</button>
        </div>

        <div className="grid2">
          <label className="label">
            <span>Navn</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="label">
            <span>Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <label className="label">
            <span>Adresse</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </div>

        <label className="label" style={{ marginTop: 14 }}>
          <span>Notat</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error ? <div style={{ color: "#fca5a5", marginTop: 12 }}>{error}</div> : null}

        <div className="rowBetween" style={{ marginTop: 16 }}>
          <div className="muted">Kunden kan opprettes direkte fra salg.</div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            Lagre kunde
          </button>
        </div>
      </div>
    </div>
  );
}
