import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { formatHTG, STATUS_LABEL, formatDate } from "@/lib/format";
import { Search, MessageCircle } from "lucide-react";

export default function MyOrders() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (query) => {
    if (!query) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await api.get(`/orders/lookup?q=${encodeURIComponent(query)}`);
      setOrders(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (params.get("q")) search(params.get("q"));
  }, []); // eslint-disable-line

  const submit = (e) => {
    e.preventDefault();
    setParams({ q });
    search(q);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase">Mes commandes</h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">Recherchez par numéro de commande, téléphone ou email.</p>

      <form onSubmit={submit} className="flex gap-2 mb-6">
        <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2">
          <Search className="w-4 h-4 text-slate-400"/>
          <input
            data-testid="mo-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="FT-XXXXXXXX ou +509 ..."
            className="bg-transparent outline-none flex-1 text-sm"
          />
        </div>
        <button data-testid="mo-search-btn" className="btn-primary">Chercher</button>
      </form>

      {loading && <div className="text-center text-slate-400 py-6">Recherche…</div>}
      {!loading && searched && orders.length === 0 && (
        <div className="cyber-card rounded-2xl p-6 text-center text-slate-400">Aucune commande trouvée.</div>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending;
          return (
            <div key={o.id} data-testid={`mo-order-${o.order_number}`} className="cyber-card rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono-a text-[#00F0FF] font-bold">{o.order_number}</div>
                  <div className="text-xs text-slate-500">{formatDate(o.created_at)}</div>
                </div>
                <span className={`pill pulse-dot ${st.cls}`}>{st.label}</span>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-400">Produit :</span> {o.product_name}</div>
                <div><span className="text-slate-400">Montant :</span> <span className="font-mono-a">{formatHTG(o.total_amount)}</span></div>
                <div><span className="text-slate-400">Méthode :</span> {o.payment_method === "moncash" ? "MonCash" : "NatCash"}</div>
                <div><span className="text-slate-400">ID Jeu :</span> <span className="font-mono-a">{o.game_id}</span></div>
              </div>
              {o.status === "rejected" && o.rejection_reason && (
                <div className="mt-3 rounded-xl p-3 bg-red-500/10 border border-red-500/30 text-sm text-red-200">
                  <b>Raison du rejet :</b> {o.rejection_reason}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Statut mis à jour: {formatDate(o.updated_at)}</span>
                <a
                  href={`https://wa.me/?text=Bonjour%2C%20ma%20commande%20FLASH-Topup%20${encodeURIComponent(o.order_number)}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#00F0FF] hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5"/> Support WhatsApp
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
