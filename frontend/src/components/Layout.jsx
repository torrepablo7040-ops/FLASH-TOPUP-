import { Link, NavLink, useNavigate } from "react-router-dom";
import { Zap, Menu, X, Search, User as UserIcon, LogIn, MessageCircle, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { api } from "@/lib/api";

const NavItem = ({ to, label, testid }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
        isActive ? "text-[#00F0FF]" : "text-slate-300 hover:text-white"
      }`
    }
  >
    {label}
  </NavLink>
);

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { customer } = useCustomerAuth() || {};
  const [wa, setWa] = useState("");
  useEffect(() => { api.get("/settings/public").then((r) => setWa((r.data.whatsapp_support || "").replace(/[^0-9+]/g, ""))).catch(() => {}); }, []);

  const submitLookup = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/mes-commandes?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col grid-mesh">
      <div className="marquee bg-cyan-950/40 border-y border-cyan-500/20 text-cyan-300 text-xs py-2 font-mono-a">
        <div className="marquee-track">
          <span className="mx-6">⚡ FLASH-Topup — Livraison en 2 à 5 minutes</span>
          <span className="mx-6">💳 Paiement MonCash & NatCash</span>
          <span className="mx-6">🎮 PUBG UC · Free Fire Diamonds · DLS · eFootball · FC Mobile · CapCut Pro</span>
          <span className="mx-6">⚡ FLASH-Topup — Livraison en 2 à 5 minutes</span>
          <span className="mx-6">💳 Paiement MonCash & NatCash</span>
          <span className="mx-6">🎮 PUBG UC · Free Fire Diamonds · DLS · eFootball · FC Mobile · CapCut Pro</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0C10]/85 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" data-testid="brand-link" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center glow-cyan-sm">
              <Zap className="w-5 h-5 text-[#00F0FF]" />
            </span>
            <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight">
              FLASH<span className="text-[#00F0FF]">-Topup</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/" label="Accueil" testid="nav-home" />
            <NavItem to="/produits" label="Produits" testid="nav-products" />
            {customer ? (
              <NavItem to="/mon-compte" label="Mon compte" testid="nav-account" />
            ) : (
              <NavItem to="/connexion" label="Connexion" testid="nav-login" />
            )}
            <NavItem to="/admin/login" label="Admin" testid="nav-admin" />
          </nav>

          <form onSubmit={submitLookup} className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              data-testid="header-lookup-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° commande ou téléphone"
              className="bg-transparent outline-none text-sm w-64 placeholder:text-slate-500"
            />
          </form>

          <button
            data-testid="mobile-menu-btn"
            className="md:hidden p-2 rounded-full bg-white/5 border border-white/10"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/5 bg-[#0A0C10]/95 px-4 py-3 flex flex-col gap-1">
            <NavItem to="/" label="Accueil" testid="mnav-home" />
            <NavItem to="/produits" label="Produits" testid="mnav-products" />
            {customer ? (
              <NavItem to="/mon-compte" label="Mon compte" testid="mnav-account" />
            ) : (
              <NavItem to="/connexion" label="Connexion" testid="mnav-login" />
            )}
            <NavItem to="/admin/login" label="Admin" testid="mnav-admin" />
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {wa && (
        <a
          data-testid="floating-whatsapp"
          href={`https://wa.me/${wa}`}
          target="_blank" rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-500 text-white shadow-xl hover:bg-emerald-400 transition"
        >
          <MessageCircle className="w-5 h-5"/> <span className="hidden sm:inline text-sm font-semibold">Support WhatsApp</span>
        </a>
      )}

      <footer className="border-t border-white/5 mt-16 py-8 px-4 text-center text-sm text-slate-500">
        <div className="max-w-7xl mx-auto">
          <div className="font-display text-slate-300 mb-2">FLASH-Topup ⚡</div>
          <div>Vendeur haïtien de crédits gaming & services numériques — Paiement MonCash & NatCash</div>
          <div className="mt-3 flex gap-4 justify-center text-xs">
            <Link to="/faq" data-testid="footer-faq" className="hover:text-white inline-flex items-center gap-1"><HelpCircle className="w-3 h-3"/> FAQ</Link>
            <Link to="/contact" data-testid="footer-contact" className="hover:text-white inline-flex items-center gap-1"><MessageCircle className="w-3 h-3"/> Contact</Link>
            <Link to="/mes-commandes" className="hover:text-white">Suivi commande</Link>
          </div>
          <div className="mt-3 text-xs text-slate-600">© {new Date().getFullYear()} FLASH-Topup — Tous droits réservés</div>
        </div>
      </footer>
    </div>
  );
}
