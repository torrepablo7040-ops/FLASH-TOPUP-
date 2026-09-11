import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatHTG, STATUS_LABEL, formatDate } from "@/lib/format";
import { Loader2, LogOut, ShoppingBag, User as UserIcon, TrendingUp, Bell } from "lucide-react";
import { toast } from "sonner";

export default function CustomerDashboard() {
  const { customer, loading, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [notifs, setNotifs] = useState([]);
  const unreadCount = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!loading && !customer) navigate("/connexion?returnTo=/mon-compte");
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!customer) return;
    api.get("/customer/orders").then((r) => setOrders(r.data)).catch(() => {});
    const load = () => api.get("/customer/notifications").then((r) => {
      const prev = notifs.length;
      setNotifs(r.data);
      if (prev > 0 && r.data.length > prev) toast.info(r.data[0].message);
    }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [customer]);

  const markRead = async () => {
    await api.post("/customer/notifications/read-all");
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
  };

  if (loading || !customer) return <div className="p-10 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin inline"/></div>;

  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;
  const totalSpent = orders.filter((o) => ["approved", "completed"].includes(o.status)).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const counts = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {customer.picture ? (
            <img src={customer.picture} alt="" className="w-12 h-12 rounded-full border border-white/10"/>
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"><UserIcon className="w-5 h-5"/></div>
          )}
          <div>
            <div className="text-xs text-slate-500 font-mono-a uppercase">Bienvenue</div>
            <div className="font-display font-extrabold text-xl">{customer.name || customer.email}</div>
            <div className="text-xs text-slate-500">{customer.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button data-testid="mark-read" onClick={markRead} className="relative inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 text-[#00F0FF] text-sm">
              <Bell className="w-4 h-4"/> {unreadCount} notification(s)
            </button>
          )}
          <button data-testid="customer-logout" onClick={async () => { await logout(); navigate("/"); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm">
            <LogOut className="w-4 h-4"/> Déconnexion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Commandes" value={orders.length} icon={<ShoppingBag className="w-4 h-4"/>}/>
        <Kpi label="En attente" value={counts.pending || 0} cls="text-amber-400"/>
        <Kpi label="Acceptées" value={(counts.approved || 0) + (counts.completed || 0)} cls="text-emerald-400"/>
        <Kpi label="Total dépensé" value={formatHTG(totalSpent)} cls="text-[#00F0FF]" icon={<TrendingUp className="w-4 h-4"/>}/>
      </div>

      <div className="flex gap-2 overflow-x-auto thin-scroll pb-2 mb-4">
        {[["", "Toutes"], ["pending", "En attente"], ["approved", "Acceptée"], ["completed", "Terminée"], ["rejected", "Refusée"]].map(([v, l]) => (
          <button
            key={v || "all"}
            data-testid={`cust-filter-${v || "all"}`}
            onClick={() => setFilter(v)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === v ? "bg-[#00F0FF] text-[#0A0C10] border-transparent" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
          >{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="cyber-card rounded-2xl p-8 text-center">
          <div className="text-slate-400 mb-3">Aucune commande {filter ? "dans cette catégorie" : "pour le moment"}.</div>
          <Link to="/produits" className="btn-primary inline-flex">Explorer les produits</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending;
            return (
              <div key={o.id} data-testid={`cust-order-${o.order_number}`} className="cyber-card rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono-a text-[#00F0FF] font-bold">{o.order_number}</div>
                    <div className="text-xs text-slate-500">{formatDate(o.created_at)}</div>
                  </div>
                  <span className={`pill pulse-dot ${st.cls}`}>{st.label}</span>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-400">Produit :</span> {o.product_name} <span className="text-slate-500">× {o.quantity}</span></div>
                  <div><span className="text-slate-400">Montant :</span> <span className="font-mono-a">{formatHTG(o.total_amount)}</span></div>
                  <div><span className="text-slate-400">Paiement :</span> {o.payment_method === "moncash" ? "MonCash" : "NatCash"}</div>
                  <div><span className="text-slate-400">ID Jeu :</span> <span className="font-mono-a">{o.game_id}</span></div>
                </div>
                {o.status === "rejected" && o.rejection_reason && (
                  <div className="mt-3 rounded-xl p-3 bg-red-500/10 border border-red-500/30 text-sm text-red-200">
                    <b>Raison du refus :</b> {o.rejection_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Kpi = ({ label, value, cls, icon }) => (
  <div className="cyber-card rounded-2xl p-4">
    <div className="text-xs uppercase text-slate-400 font-mono-a flex items-center gap-1">{icon}{label}</div>
    <div className={`font-display font-extrabold text-xl sm:text-2xl mt-1 ${cls || ""}`}>{value}</div>
  </div>
);
