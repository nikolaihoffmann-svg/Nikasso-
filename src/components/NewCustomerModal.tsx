import { useEffect, useState } from "react";
import type { Customer } from "../types";
import { createCustomer, updateCustomer } from "../app/storage";

type Props = {
  open: boolean;
  initialName?: string;
  customer?: Customer | null;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
};

export default function NewCustomerModal({
  open,
  initialName = "",
  customer = null,
  onClose,
  onCreated,
}: Props) {
  const isEdit = Boolean(customer);

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setAddress(customer.address ?? "");
      setNote(customer.note ?? "");
      setError("");
      return;
    }

    setName(initialName || "");
    setPhone("");
    setAddress("");
    setNote("");
    setError("");
  }, [open, initialName, customer]);

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
      if (customer) {
        const updated = updateCustomer(customer.id, {
          name,
          phone,
          address,
          note,
        });
        onCreated(updated);
      } else {
        const created = createCustomer({
          name,
          phone,
          address,
          note,
        });
        onCreated(created);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre kunde");
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Rediger kunde" : "Ny kunde"}
      >
        <div className="rowBetween modalHeader">
          <div>
            <h2 className="sectionTitle" style={{ marginBottom: 6 }}>
              {isEdit ? "Rediger kunde" : "Ny kunde"}
            </h2>
            <div className="muted">
              {isEdit
                ? "Oppdater kundeinfo og notater."
                : "Opprett kunde direkte fra salgsflyten."}
            </div>
          </div>

          <button className="btn" type="button" onClick={onClose}>
            Lukk
          </button>
        </div>

        <div className="grid2">
          <label className="label">
            <span>Navn</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Ola Nordmann"
            />
          </label>

          <label className="label">
            <span>Telefon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Valgfritt"
            />
          </label>

          <label className="label">
            <span>Adresse</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Valgfritt"
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
          <div className="muted">
            {isEdit
              ? "Endringer lagres direkte på kunden."
              : "Kunden kan brukes med én gang i salg og gjeld."}
          </div>
          <button className="btn btnPrimary" type="button" onClick={handleSave}>
            {isEdit ? "Lagre endringer" : "Lagre kunde"}
          </button>
        </div>
      </div>
    </div>
  );
}
