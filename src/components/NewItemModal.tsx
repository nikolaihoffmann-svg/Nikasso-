import React from "react";

type Props = {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (item: unknown) => void;
};

export default function NewItemModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div>
      <div>Ny vare</div>
      <button type="button" onClick={onClose}>
        Lukk
      </button>
    </div>
  );
}
