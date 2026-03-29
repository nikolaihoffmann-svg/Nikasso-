export default function Logo() {
  return (
    <div className="logo" aria-label="Nikasso">
      <div className="logoIcon" aria-hidden="true">
        <span className="logoIconN">N</span>
        <span className="logoIconPlus">+</span>
      </div>

      <div className="logoWordmarkWrap">
        <span className="logoText">Nikasso</span>
        <span className="logoSub">lager, salg og gjeld</span>
      </div>
    </div>
  );
}
