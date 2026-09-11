import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatHTG } from "@/lib/format";
import { Zap, Rocket, ShieldCheck, Timer, ChevronRight } from "lucide-react";

const CATEGORY_IMG = {
  pubg: "https://images.unsplash.com/photo-1564049489314-60d154ff107d?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  freefire: "https://images.unsplash.com/photo-1655802895804-60db735c791b?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  efootball: "https://images.unsplash.com/photo-1546443046-ed1ce6ffd1ab?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  dls: "https://images.unsplash.com/photo-1623934199716-dc28818a6ec7?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  fcmobile: "https://images.unsplash.com/photo-1685914960983-8ddf0b372e59?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  capcut: "https://images.unsplash.com/photo-1655802906408-0ed1bc38a6dd?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
  autres: "https://images.unsplash.com/photo-1665142726875-f931a29dcee3?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
};

export default function Home() {
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    Promise.all([
      api.get("/categories"),
      api.get("/products?only_available=true"),
      api.get("/settings/public"),
    ]).then(([c, p, s]) => {
      setCats(c.data);
      setProducts(p.data);
      setSettings(s.data);
    }).catch(() => {});
  }, []);

  const featured = products.slice(0, 8);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/5 text-[#00F0FF] text-xs font-mono-a mb-4">
              <span className="pulse-dot" />
              LIVE — 100% haïtien · MonCash & NatCash
            </div>
            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight uppercase">
              {settings.hero_heading || "FLASH-Topup — Rechargez à la vitesse de l'éclair"}
              <span className="text-[#00F0FF]"> ⚡</span>
            </h1>
            <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-2xl">
              {settings.hero_subheading || "PUBG Mobile, Free Fire, DLS, eFootball, FC Mobile, CapCut Pro. Paiement MonCash / NatCash. Livraison 2-5 min."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/produits" data-testid="hero-cta-products" className="btn-primary inline-flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Voir les produits
              </Link>
              <Link to="/mes-commandes" data-testid="hero-cta-track" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold">
                <Timer className="w-4 h-4" /> Suivre ma commande
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
              <FeatBadge icon={<Zap className="w-4 h-4" />} title="Instant" sub="2-5 min" />
              <FeatBadge icon={<ShieldCheck className="w-4 h-4" />} title="Sécurisé" sub="Admin vérifié" />
              <FeatBadge icon={<Timer className="w-4 h-4" />} title="HTG" sub="Gourdes" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 glow-cyan-sm">
              <img
                alt="gaming"
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
                className="w-full h-72 sm:h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C10] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono-a text-[#00F0FF] uppercase">Populaire</div>
                  <div className="font-display font-bold text-lg">PUBG Mobile · Free Fire · DLS</div>
                </div>
                <Link to="/produits" data-testid="hero-arrow" className="w-10 h-10 rounded-full bg-[#00F0FF] text-[#0A0C10] flex items-center justify-center">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-display text-xl sm:text-2xl font-bold">Catégories</h2>
            <Link to="/produits" className="text-sm text-[#00F0FF] hover:underline">Tout voir →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {cats.map((c) => (
              <Link
                key={c.id}
                to={`/produits?cat=${c.id}`}
                data-testid={`cat-card-${c.slug}`}
                className="cyber-card rounded-2xl p-4 flex items-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                  <img alt={c.name} src={CATEGORY_IMG[c.slug] || CATEGORY_IMG.autres} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-slate-400">Voir →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-display text-xl sm:text-2xl font-bold">Produits populaires</h2>
            <Link to="/produits" className="text-sm text-[#00F0FF] hover:underline">Tout voir →</Link>
          </div>
          {featured.length === 0 ? (
            <div className="cyber-card rounded-2xl p-8 text-center text-slate-400">
              Aucun produit pour le moment. L'admin peut en ajouter depuis le dashboard.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {featured.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const FeatBadge = ({ icon, title, sub }) => (
  <div className="cyber-card rounded-xl px-3 py-3">
    <div className="flex items-center gap-2 text-[#00F0FF]">{icon}<span className="text-xs uppercase font-mono-a">{title}</span></div>
    <div className="text-xs text-slate-400 mt-1">{sub}</div>
  </div>
);

export const ProductCard = ({ p }) => (
  <Link
    to={`/produits/${p.id}`}
    data-testid={`product-card-${p.id}`}
    className="cyber-card rounded-2xl overflow-hidden group flex flex-col"
  >
    <div className="aspect-square bg-white/5 relative overflow-hidden">
      {p.image_url ? (
        <img alt={p.name} src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <Zap className="w-10 h-10" />
        </div>
      )}
      {!p.available && (
        <div className="absolute top-2 right-2 pill status-rejected">Indisponible</div>
      )}
    </div>
    <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
      <div className="text-sm sm:text-base font-semibold line-clamp-2 min-h-[2.5rem]">{p.name}</div>
      <div className="mt-auto flex items-center justify-between">
        <div className="font-mono-a text-[#00F0FF] font-bold text-sm sm:text-base">{formatHTG(p.price)}</div>
        <span className="text-xs px-2 py-1 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 font-mono-a">Recharger</span>
      </div>
    </div>
  </Link>
);
