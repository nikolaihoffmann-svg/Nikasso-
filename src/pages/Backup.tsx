export default function Backup() {
  return (
    <div style={pageStyle}>
      <h1>Backup</h1>
      <div style={cardStyle}>Eksport / import kommer snart.</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  color: "#fff",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 16,
};
