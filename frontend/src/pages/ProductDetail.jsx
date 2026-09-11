import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatHTG } from "@/lib/format";
import { Zap, ArrowLeft, ShieldCheck } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => setP(r.data)).catch(() => setErr("Produit introuvable"));
  }, [id]);

  if (err) return <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">{err}</div>;
  if (!p) return <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">Chargement…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/produits" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ArrowLeft className="w-4 h-4"/>Retour</Link>
      <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
        <div className="cyber-card rounded-3xl overflow-hidden">
          <div className="aspect-square bg-white/5">
            {p.image_url ? (
              <img alt={p.name} src={p.image_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600"><Zap className="w-16 h-16"/></div>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-mono-a text-[#00F0FF] uppercase mb-2 pulse-dot">Livraison rapide 2-5 min</div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold leading-tight">{p.name}</h1>
          <div className="mt-4 text-slate-300 whitespace-pre-line">{p.description || "—"}</div>
          <div className="mt-6 flex items-baseline gap-3">
            <div className="font-mono-a text-3xl sm:text-4xl font-extrabold text-[#00F0FF]">{formatHTG(p.price)}</div>
            <div className="text-xs text-slate-500">Prix TTC · marge incluse</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/commander/${p.id}`}
              data-testid="pd-buy-btn"
              className={`btn-primary inline-flex items-center gap-2 ${!p.available && "pointer-events-none opacity-50"}`}
            >
              <Zap className="w-4 h-4"/> Commander maintenant
            </Link>
            {!p.available && <span className="pill status-rejected">Indisponible</span>}
          </div>
          <div className="mt-6 cyber-card rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#00F0FF] mt-0.5"/>
            <div className="text-sm text-slate-300">
              Paiement sécurisé via MonCash ou NatCash. Aucune commande n'est validée sans vérification manuelle par un administrateur autorisé.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
