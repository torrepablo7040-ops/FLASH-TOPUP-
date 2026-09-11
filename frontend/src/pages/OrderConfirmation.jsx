import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatHTG, STATUS_LABEL, formatDate } from "@/lib/format";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [o, setO] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderNumber}`).then((r) => setO(r.data)).catch(() => {});
  }, [orderNumber]);

  if (!o) return <div className="p-10 text-center text-slate-400">Chargement…</div>;
  const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="cyber-card rounded-3xl p-6 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center mx-auto glow-cyan-sm">
          <CheckCircle2 className="w-8 h-8 text-[#00F0FF]"/>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-4 uppercase">Commande reçue</h1>
        <p className="text-slate-300 mt-2 text-sm sm:text-base">Merci ! Un admin va vérifier votre paiement.</p>

        <div className="mt-6 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2 font-mono-a">
          <span className="text-slate-400 text-xs">N° commande</span>
          <span data-testid="oc-order-number" className="text-[#00F0FF] font-bold">{o.order_number}</span>
          <button onClick={() => { navigator.clipboard.writeText(o.order_number); toast.success("Copié"); }}>
            <Copy className="w-4 h-4 text-slate-400 hover:text-white"/>
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <span className={`pill pulse-dot ${st.cls}`}>{st.label}</span>
        </div>

        <div className="mt-8 text-left grid sm:grid-cols-2 gap-3 text-sm">
          <Info label="Produit" value={o.product_name}/>
          <Info label="Montant" value={formatHTG(o.total_amount)}/>
          <Info label="Méthode" value={o.payment_method === "moncash" ? "MonCash" : "NatCash"}/>
          <Info label="ID de transaction" value={o.transaction_id}/>
          <Info label="ID Jeu" value={o.game_id}/>
          <Info label="Date" value={formatDate(o.created_at)}/>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to={`/mes-commandes?q=${o.order_number}`} data-testid="oc-track-btn" className="btn-primary">Suivre ma commande</Link>
          <Link to="/produits" className="px-5 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold">Retour aux produits</Link>
        </div>
      </div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
    <div className="text-xs text-slate-400">{label}</div>
    <div className="font-mono-a mt-0.5 break-all">{value}</div>
  </div>
);
