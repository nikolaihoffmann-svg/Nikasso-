import { useEffect, useState } from "react";
import "./styles.css";
import { ensureSeedData } from "./storage";
import Logo from "./Logo";
import Oversikt from "../pages/Oversikt";
import Varer from "../pages/Varer";
import Innkjop from "../pages/Innkjop";

type Tab = "oversikt" | "varer" | "innkjop" | "data";

const navItems: Array<{ key: Tab; label: string }> = [
  { key: "oversikt", label: "Oversikt" },
  { key: "varer", label: "Varer" },
  { key: "innkjop", label: "Innkjøp" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("oversikt");

  useEffect(() => {
    ensureSeedData();
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const content =
    tab === "oversikt" ? <Oversikt /> :
    tab === "varer" ? <Varer /> :
    tab === "innkjop" ? <Innkjop /> :
    <div>Data</div>;

  return (
    <div className="app">
      <div className="bgGlow bgGlowBlue" />
      <div className="bgGlow bgGlowGold" />

      <header className="header">
        <div className="headerTop">
          <Logo />

          <button
            className="iconBtn"
            type="button"
            onClick={() => setTab("data")}
            aria-label="Data"
            title="Data"
          >
            ⚙️
          </button>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "navBtn active" : "navBtn"}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">{content}</main>
    </div>
  );
}
