import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, BACKEND_URL } from "@/lib/api";
import { formatHTG, STATUS_LABEL, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, LogOut, Package, ShoppingBag, Users, Settings, Image as ImageIcon, Shield, Layers, DollarSign, Plus, Trash2, Edit2, Check, X, Upload, Copy, Eye, Activity, Mail, Ticket, Star, Award, Zap } from "lucide-react";

const TABS = [
  { id: "overview", label: "Aperçu", icon: DollarSign },
  { id: "orders", label: "Commandes", icon: ShoppingBag },
  { id: "products", label: "Produits", icon: Package },
  { id: "categories", label: "Catégories", icon: Layers },
  { id: "banners", label: "Bannières", icon: ImageIcon },
  { id: "subscriptions", label: "Abonnements", icon: Zap },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "loyalty", label: "Fidélité", icon: Star },
  { id: "resellers", label: "Revendeurs", icon: Award },
  { id: "payments", label: "Paiements", icon: Settings },
  { id: "customers", label: "Clients", icon: Users },
  { id: "messages", label: "Messages", icon: Mail },
  { id: "logs", label: "Historique", icon: Activity },
  { id: "admins", label: "Admins", icon: Shield },
];

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!loading && !user) navigate("/admin/login");
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="p-10 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin inline"/></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="text-xs font-mono-a uppercase text-[#00F0FF]">Dashboard</div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase">Administration</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-300 hidden sm:block">
            <div className="font-semibold">{user.name || user.email}</div>
            <div className="text-xs text-slate-500">{user.role === "super_admin" ? "Super Admin" : "Admin"}</div>
          </div>
          <button data-testid="admin-logout" onClick={async () => { await logout(); navigate("/admin/login"); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm">
            <LogOut className="w-4 h-4"/> Déconnexion
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto thin-scroll pb-3 mb-6 -mx-1 px-1">
        {TABS.map((t) => {
          if (t.id === "admins" && user.role !== "super_admin") return null;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition ${
                tab === t.id ? "bg-[#00F0FF] text-[#0A0C10] border-transparent" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4"/> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview/>}
      {tab === "orders" && <Orders/>}
      {tab === "products" && <Products/>}
      {tab === "categories" && <Categories/>}
      {tab === "banners" && <Banners/>}
      {tab === "subscriptions" && <Subscriptions/>}
      {tab === "coupons" && <Coupons/>}
      {tab === "loyalty" && <Loyalty/>}
      {tab === "resellers" && <Resellers/>}
      {tab === "payments" && <Payments/>}
      {tab === "customers" && <Customers/>}
      {tab === "messages" && <Messages/>}
      {tab === "logs" && <Logs/>}
      {tab === "admins" && user.role === "super_admin" && <Admins me={user}/>}
    </div>
  );
}

// ------ OVERVIEW
function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setS(r.data)); }, []);
  if (!s) return <div className="text-slate-400">Chargement…</div>;
  const kpis = [
    { label: "Revenus", value: formatHTG(s.revenue), cls: "text-[#00F0FF]" },
    { label: "Total commandes", value: s.total_orders },
    { label: "En attente", value: s.pending, cls: "text-amber-400" },
    { label: "Approuvées", value: s.approved, cls: "text-emerald-400" },
    { label: "Rejetées", value: s.rejected, cls: "text-red-400" },
    { label: "Terminées", value: s.completed, cls: "text-blue-400" },
    { label: "Produits", value: s.products },
    { label: "Clients", value: s.customers },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((k) => (
        <div key={k.label} className="cyber-card rounded-2xl p-4">
          <div className="text-xs uppercase text-slate-400 font-mono-a">{k.label}</div>
          <div className={`font-display font-extrabold text-2xl mt-1 ${k.cls || ""}`}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ------ ORDERS
function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [viewing, setViewing] = useState(null);

  const load = () => api.get(`/admin/orders${filter ? `?status=${filter}` : ""}`).then((r) => setOrders(r.data));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  const act = async (o, action, body) => {
    try {
      await api.post(`/admin/orders/${o.id}/${action}`, body || {});
      toast.success("Commande mise à jour");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "pending", "approved", "rejected", "completed"].map((f) => (
          <button
            key={f || "all"}
            data-testid={`orders-filter-${f || "all"}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f ? "bg-[#00F0FF] text-[#0A0C10] border-transparent" : "bg-white/5 border-white/10 text-slate-300"}`}
          >{f ? (STATUS_LABEL[f]?.label || f) : "Toutes"}</button>
        ))}
      </div>

      <div className="cyber-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left">
              <tr className="text-xs uppercase text-slate-400">
                <th className="p-3">N°</th>
                <th className="p-3">Produit</th>
                <th className="p-3">Client</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Paiement</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending;
                return (
                  <tr key={o.id} className="border-t border-white/5 hover:bg-white/5" data-testid={`row-order-${o.order_number}`}>
                    <td className="p-3 font-mono-a text-[#00F0FF]">{o.order_number}</td>
                    <td className="p-3">{o.product_name} <span className="text-slate-500">× {o.quantity}</span></td>
                    <td className="p-3">{o.customer_name}<div className="text-xs text-slate-500">{o.customer_phone}</div></td>
                    <td className="p-3 font-mono-a">{formatHTG(o.total_amount)}</td>
                    <td className="p-3">{o.payment_method === "moncash" ? "MonCash" : "NatCash"}</td>
                    <td className="p-3"><span className={`pill ${st.cls}`}>{st.label}</span></td>
                    <td className="p-3 text-xs text-slate-400">{formatDate(o.created_at)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        <button data-testid={`view-order-${o.order_number}`} onClick={() => setViewing(o)} className="p-1.5 rounded bg-white/5 hover:bg-white/10"><Eye className="w-3.5 h-3.5"/></button>
                        {o.status === "pending" && (
                          <>
                            <button data-testid={`approve-${o.order_number}`} onClick={() => act(o, "approve")} className="p-1.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="w-3.5 h-3.5"/></button>
                            <button data-testid={`reject-${o.order_number}`} onClick={() => { setRejecting(o); setReason(""); }} className="p-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"><X className="w-3.5 h-3.5"/></button>
                          </>
                        )}
                        {o.status === "approved" && (
                          <button data-testid={`complete-${o.order_number}`} onClick={() => act(o, "complete")} className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-semibold">Terminer</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucune commande.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <Modal onClose={() => setViewing(null)} title={`Commande ${viewing.order_number}`}>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Info label="Produit" value={`${viewing.product_name} × ${viewing.quantity}`}/>
            <Info label="Montant" value={formatHTG(viewing.total_amount)}/>
            <Info label="Client" value={viewing.customer_name}/>
            <Info label="Téléphone" value={viewing.customer_phone}/>
            <Info label="Email" value={viewing.customer_email || "—"}/>
            <Info label="ID Jeu" value={viewing.game_id}/>
            <Info label="Info supplémentaire" value={viewing.delivery_info || "—"}/>
            <Info label="Méthode" value={viewing.payment_method}/>
            <Info label="Bénéficiaire" value={viewing.payment_beneficiary_name}/>
            <Info label="N° reçu" value={viewing.payment_receiver_number}/>
            <Info label="ID Transaction" value={viewing.transaction_id}/>
            <Info label="Statut" value={viewing.status}/>
          </div>
          {viewing.proof_image_url && (
            <div className="mt-4">
              <div className="text-xs text-slate-400 mb-1">Preuve de paiement</div>
              <img src={`${BACKEND_URL}${viewing.proof_image_url}`} alt="proof" className="max-h-96 rounded-xl border border-white/10"/>
            </div>
          )}
        </Modal>
      )}

      {rejecting && (
        <Modal onClose={() => setRejecting(null)} title={`Rejeter ${rejecting.order_number}`}>
          <textarea
            data-testid="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 min-h-28 outline-none"
            placeholder="Raison du rejet (visible par le client)…"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button>
            <button data-testid="confirm-reject" onClick={async () => { await act(rejecting, "reject", { reason }); setRejecting(null); }} className="btn-primary bg-red-500 text-white" style={{ background: "linear-gradient(180deg,#EF4444,#B91C1C)" }}>Rejeter</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------ PRODUCTS
function Products() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: "", description: "", image_url: "", base_price: 0, category_id: "", available: true };
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const load = () => Promise.all([api.get("/products"), api.get("/categories")]).then(([p, c]) => { setItems(p.data); setCats(c.data); });
  useEffect(() => { load(); }, []);

  const start = (item) => { setEditing(item?.id || "new"); setForm(item ? { ...item } : emptyForm); };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.name.trim() || !form.category_id || !form.base_price) return toast.error("Nom, catégorie et prix requis");
    try {
      const payload = { ...form, base_price: Number(form.base_price) };
      if (editing === "new") await api.post("/admin/products", payload);
      else await api.put(`/admin/products/${editing}`, payload);
      toast.success("Enregistré");
      cancel(); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const del = async (item) => {
    if (!window.confirm(`Supprimer ${item.name} ?`)) return;
    await api.delete(`/admin/products/${item.id}`);
    load();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, image_url: `${BACKEND_URL}${r.data.url}` }));
      toast.success("Image uploadée");
    } catch (e) { toast.error("Échec upload"); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-slate-400 text-sm">{items.length} produit(s)</div>
        <button data-testid="new-product" onClick={() => start(null)} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Nouveau produit</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((p) => (
          <div key={p.id} className="cyber-card rounded-2xl p-3">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 shrink-0">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover"/> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{cats.find((c) => c.id === p.category_id)?.name || "—"}</div>
                <div className="font-mono-a text-[#00F0FF] mt-1">{formatHTG(p.price)}</div>
                <div className="text-xs text-slate-500">Base: {formatHTG(p.base_price)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`pill ${p.available ? "status-approved" : "status-rejected"}`}>{p.available ? "Disponible" : "Indisponible"}</span>
              <div className="flex gap-1">
                <button data-testid={`edit-product-${p.id}`} onClick={() => start(p)} className="p-1.5 rounded bg-white/5 hover:bg-white/10"><Edit2 className="w-3.5 h-3.5"/></button>
                <button data-testid={`del-product-${p.id}`} onClick={() => del(p)} className="p-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal onClose={cancel} title={editing === "new" ? "Nouveau produit" : "Modifier le produit"}>
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Nom
              <input data-testid="prod-name" className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
            </label>
            <label className="block text-xs text-slate-400">Description
              <textarea data-testid="prod-desc" className="input mt-1 min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">Prix de base (HTG)
                <input data-testid="prod-price" type="number" className="input mt-1" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })}/>
              </label>
              <label className="block text-xs text-slate-400">Catégorie
                <select data-testid="prod-cat" className="input mt-1" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-400">Image
              <div className="flex items-center gap-3 mt-1">
                <input className="input flex-1" placeholder="URL ou upload" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}/>
                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-sm">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>} Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])}/>
                </label>
              </div>
              {form.image_url && <img src={form.image_url} alt="" className="mt-2 max-h-40 rounded-xl border border-white/10"/>}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input data-testid="prod-avail" type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })}/>
              Disponible
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={cancel} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button>
              <button data-testid="save-product" onClick={save} className="btn-primary">Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
      <InputStyles/>
    </div>
  );
}

// ------ CATEGORIES
function Categories() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "" });
  const load = () => api.get("/categories").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.slug) return toast.error("Nom et slug requis");
    if (editing === "new") await api.post("/admin/categories", form);
    else await api.put(`/admin/categories/${editing}`, form);
    setEditing(null); setForm({ name: "", slug: "", icon: "" });
    load();
  };
  const del = async (c) => { if (window.confirm(`Supprimer ${c.name} ?`)) { await api.delete(`/admin/categories/${c.id}`); load(); }};

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button data-testid="new-cat" onClick={() => { setEditing("new"); setForm({ name: "", slug: "", icon: "" }); }} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Nouvelle catégorie</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((c) => (
          <div key={c.id} className="cyber-card rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-slate-500 font-mono-a">/{c.slug}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(c.id); setForm({ name: c.name, slug: c.slug, icon: c.icon || "" }); }} className="p-1.5 rounded bg-white/5 hover:bg-white/10"><Edit2 className="w-3.5 h-3.5"/></button>
              <button onClick={() => del(c)} className="p-1.5 rounded bg-red-500/20 text-red-300"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Catégorie">
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Nom<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Slug<input className="input mt-1" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}/></label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button>
              <button onClick={save} className="btn-primary">Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
      <InputStyles/>
    </div>
  );
}

// ------ BANNERS
function Banners() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "", active: true, order: 0 });
  const load = () => api.get("/admin/banners").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (editing === "new") await api.post("/admin/banners", form);
    else await api.put(`/admin/banners/${editing}`, form);
    setEditing(null); load();
  };
  const del = async (b) => { if (window.confirm("Supprimer ?")) { await api.delete(`/admin/banners/${b.id}`); load(); }};
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setEditing("new"); setForm({ title: "", subtitle: "", image_url: "", link_url: "", active: true, order: items.length }); }} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Nouvelle bannière</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((b) => (
          <div key={b.id} className="cyber-card rounded-2xl overflow-hidden">
            {b.image_url && <img src={b.image_url} alt="" className="w-full h-32 object-cover"/>}
            <div className="p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{b.title}</div>
                <div className="text-xs text-slate-400">{b.subtitle}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(b.id); setForm({ ...b }); }} className="p-1.5 rounded bg-white/5"><Edit2 className="w-3.5 h-3.5"/></button>
                <button onClick={() => del(b)} className="p-1.5 rounded bg-red-500/20 text-red-300"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Bannière">
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Titre<input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Sous-titre<input className="input mt-1" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Image URL<input className="input mt-1" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Lien<input className="input mt-1" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })}/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/> Active</label>
            <div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button><button onClick={save} className="btn-primary">Enregistrer</button></div>
          </div>
        </Modal>
      )}
      <InputStyles/>
    </div>
  );
}

// ------ PAYMENTS SETTINGS
function Payments() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <div className="text-slate-400">Chargement…</div>;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", {
        margin_percent: Number(s.margin_percent),
        moncash_number: s.moncash_number, moncash_beneficiary: s.moncash_beneficiary,
        natcash_number: s.natcash_number, natcash_beneficiary: s.natcash_beneficiary,
        payment_instructions: s.payment_instructions,
        site_title: s.site_title, site_tagline: s.site_tagline,
        hero_heading: s.hero_heading, hero_subheading: s.hero_subheading,
        whatsapp_support: s.whatsapp_support,
      });
      toast.success("Paramètres enregistrés");
    } catch (e) { toast.error("Erreur"); }
    finally { setSaving(false); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="cyber-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold">Marge & MonCash</h3>
        <label className="block text-xs text-slate-400">Marge (%)<input data-testid="margin-input" type="number" className="input mt-1" value={s.margin_percent} onChange={(e) => set("margin_percent", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Nom bénéficiaire MonCash<input className="input mt-1" value={s.moncash_beneficiary || ""} onChange={(e) => set("moncash_beneficiary", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Numéro MonCash<input className="input mt-1" value={s.moncash_number || ""} onChange={(e) => set("moncash_number", e.target.value)}/></label>
      </div>
      <div className="cyber-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold">NatCash & Instructions</h3>
        <label className="block text-xs text-slate-400">Nom bénéficiaire NatCash<input className="input mt-1" value={s.natcash_beneficiary || ""} onChange={(e) => set("natcash_beneficiary", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Numéro NatCash<input className="input mt-1" value={s.natcash_number || ""} onChange={(e) => set("natcash_number", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Instructions de paiement<textarea className="input mt-1 min-h-24" value={s.payment_instructions || ""} onChange={(e) => set("payment_instructions", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">WhatsApp support<input className="input mt-1" value={s.whatsapp_support || ""} onChange={(e) => set("whatsapp_support", e.target.value)}/></label>
      </div>
      <div className="cyber-card rounded-2xl p-5 space-y-3 lg:col-span-2">
        <h3 className="font-display font-bold">Textes du site</h3>
        <label className="block text-xs text-slate-400">Titre du site<input className="input mt-1" value={s.site_title || ""} onChange={(e) => set("site_title", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Slogan<input className="input mt-1" value={s.site_tagline || ""} onChange={(e) => set("site_tagline", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Hero titre<input className="input mt-1" value={s.hero_heading || ""} onChange={(e) => set("hero_heading", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Hero sous-titre<textarea className="input mt-1" value={s.hero_subheading || ""} onChange={(e) => set("hero_subheading", e.target.value)}/></label>
      </div>
      <div className="lg:col-span-2">
        <button data-testid="save-settings" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin"/>}Enregistrer les modifications</button>
      </div>
      <InputStyles/>
    </div>
  );
}

// ------ CUSTOMERS
function Customers() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/customers").then((r) => setItems(r.data)); }, []);
  return (
    <div className="cyber-card rounded-2xl overflow-x-auto thin-scroll">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
          <tr><th className="p-3">Nom</th><th className="p-3">Téléphone</th><th className="p-3">Email</th><th className="p-3">Commandes</th><th className="p-3">Total dépensé</th></tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.phone} className="border-t border-white/5">
              <td className="p-3">{c.name}</td>
              <td className="p-3 font-mono-a">{c.phone}</td>
              <td className="p-3">{c.email || "—"}</td>
              <td className="p-3">{c.orders_count}</td>
              <td className="p-3 font-mono-a">{formatHTG(c.total_spent)}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun client.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ------ ADMINS
function Admins({ me }) {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const load = () => api.get("/admin/admins").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!email.trim()) return;
    try { await api.post("/admin/admins", { email: email.trim(), role }); toast.success("Admin ajouté"); setEmail(""); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const del = async (a) => { if (window.confirm(`Supprimer ${a.email} ?`)) { await api.delete(`/admin/admins/${a.id}`); load(); }};
  return (
    <div>
      <div className="cyber-card rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <input data-testid="admin-email" className="input flex-1" placeholder="email@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)}/>
        <select className="input sm:w-48" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <button data-testid="add-admin" onClick={add} className="btn-primary">Ajouter</button>
      </div>
      <div className="cyber-card rounded-2xl overflow-x-auto thin-scroll">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
            <tr><th className="p-3">Email</th><th className="p-3">Nom</th><th className="p-3">Rôle</th><th className="p-3">Action</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-white/5">
                <td className="p-3 font-mono-a">{a.email}</td>
                <td className="p-3">{a.name || "—"}</td>
                <td className="p-3"><span className={`pill ${a.role === "super_admin" ? "status-approved" : "status-completed"}`}>{a.role === "super_admin" ? "Super Admin" : "Admin"}</span></td>
                <td className="p-3">
                  {a.email !== me.email && <button onClick={() => del(a)} className="p-1.5 rounded bg-red-500/20 text-red-300"><Trash2 className="w-3.5 h-3.5"/></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InputStyles/>
    </div>
  );
}

// ------ SUBSCRIPTIONS
function Subscriptions() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const empty = { name: "", description: "", image_url: "", base_price: 0, duration_days: 30, features: [], active: true };
  const [form, setForm] = useState(empty);
  const load = () => api.get("/admin/subscriptions").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.name || !form.base_price) return toast.error("Nom & prix requis");
    const payload = { ...form, base_price: Number(form.base_price), duration_days: Number(form.duration_days), features: (form.features_text || "").split("\n").filter(Boolean) };
    delete payload.features_text;
    if (editing === "new") await api.post("/admin/subscriptions", payload);
    else await api.put(`/admin/subscriptions/${editing}`, payload);
    toast.success("Enregistré"); setEditing(null); load();
  };
  const del = async (s) => { if (window.confirm(`Supprimer ${s.name} ?`)) { await api.delete(`/admin/subscriptions/${s.id}`); load(); }};
  return (
    <div>
      <div className="flex justify-end mb-4"><button data-testid="new-sub" onClick={() => { setEditing("new"); setForm({ ...empty, features_text: "" }); }} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Nouvel abonnement</button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((s) => (
          <div key={s.id} className="cyber-card rounded-2xl p-4">
            <div className="flex justify-between"><div className="font-semibold">{s.name}</div><span className={`pill ${s.active ? "status-approved" : "status-rejected"}`}>{s.active ? "Actif" : "Inactif"}</span></div>
            <div className="text-xs text-slate-400 mt-1">{s.duration_days} jours</div>
            <div className="font-mono-a text-[#00F0FF] mt-2">{formatHTG(s.base_price)}</div>
            <ul className="text-xs text-slate-400 mt-2 list-disc pl-4">{(s.features || []).slice(0, 4).map((f, i) => <li key={i}>{f}</li>)}</ul>
            <div className="mt-3 flex gap-1"><button onClick={() => { setEditing(s.id); setForm({ ...s, features_text: (s.features || []).join("\n") }); }} className="p-1.5 rounded bg-white/5"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={() => del(s)} className="p-1.5 rounded bg-red-500/20 text-red-300"><Trash2 className="w-3.5 h-3.5"/></button></div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Abonnement">
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Nom<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Description<textarea className="input mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">Prix HTG<input type="number" className="input mt-1" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })}/></label>
              <label className="block text-xs text-slate-400">Durée (jours)<input type="number" className="input mt-1" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })}/></label>
            </div>
            <label className="block text-xs text-slate-400">Image URL<input className="input mt-1" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}/></label>
            <label className="block text-xs text-slate-400">Fonctionnalités (1 par ligne)<textarea className="input mt-1 min-h-24" value={form.features_text || ""} onChange={(e) => setForm({ ...form, features_text: e.target.value })}/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/> Actif</label>
            <div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button><button onClick={save} className="btn-primary">Enregistrer</button></div>
          </div>
        </Modal>
      )}
      <InputStyles/>
    </div>
  );
}

// ------ COUPONS
function Coupons() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const empty = { code: "", discount_percent: 0, discount_amount: 0, active: true, max_uses: 0, expires_at: "" };
  const [form, setForm] = useState(empty);
  const load = () => api.get("/admin/coupons").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.code) return toast.error("Code requis");
    const payload = { ...form, discount_percent: Number(form.discount_percent), discount_amount: Number(form.discount_amount), max_uses: Number(form.max_uses), expires_at: form.expires_at || null };
    if (editing === "new") await api.post("/admin/coupons", payload);
    else await api.put(`/admin/coupons/${editing}`, payload);
    toast.success("Enregistré"); setEditing(null); load();
  };
  const del = async (c) => { if (window.confirm(`Supprimer ${c.code} ?`)) { await api.delete(`/admin/coupons/${c.id}`); load(); }};
  return (
    <div>
      <div className="flex justify-end mb-4"><button data-testid="new-coupon" onClick={() => { setEditing("new"); setForm(empty); }} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Nouveau coupon</button></div>
      <div className="cyber-card rounded-2xl overflow-x-auto thin-scroll">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-slate-400"><tr><th className="p-3">Code</th><th className="p-3">Réduction</th><th className="p-3">Utilisations</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="p-3 font-mono-a text-[#00F0FF]">{c.code}</td>
                <td className="p-3">{c.discount_percent}% {c.discount_amount ? `+ ${c.discount_amount} HTG` : ""}</td>
                <td className="p-3">{c.uses}/{c.max_uses || "∞"}</td>
                <td className="p-3"><span className={`pill ${c.active ? "status-approved" : "status-rejected"}`}>{c.active ? "Actif" : "Inactif"}</span></td>
                <td className="p-3 flex gap-1"><button onClick={() => { setEditing(c.id); setForm({ ...c, expires_at: c.expires_at || "" }); }} className="p-1.5 rounded bg-white/5"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={() => del(c)} className="p-1.5 rounded bg-red-500/20 text-red-300"><Trash2 className="w-3.5 h-3.5"/></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun coupon.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Coupon">
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Code<input className="input mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}/></label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">Réduction %<input type="number" className="input mt-1" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}/></label>
              <label className="block text-xs text-slate-400">Réduction HTG<input type="number" className="input mt-1" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}/></label>
              <label className="block text-xs text-slate-400">Max utilisations (0=∞)<input type="number" className="input mt-1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}/></label>
              <label className="block text-xs text-slate-400">Expire le<input type="datetime-local" className="input mt-1" value={form.expires_at ? form.expires_at.slice(0, 16) : ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}/></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/> Actif</label>
            <div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Annuler</button><button onClick={save} className="btn-primary">Enregistrer</button></div>
          </div>
        </Modal>
      )}
      <InputStyles/>
    </div>
  );
}

// ------ LOYALTY
function Loyalty() {
  const [l, setL] = useState(null);
  useEffect(() => { api.get("/admin/loyalty").then((r) => setL(r.data)); }, []);
  if (!l) return <div className="text-slate-400">Chargement…</div>;
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const save = async () => {
    await api.put("/admin/loyalty", {
      active: l.active,
      points_per_htg: Number(l.points_per_htg),
      htg_per_point: Number(l.htg_per_point),
      min_redeem_points: Number(l.min_redeem_points),
      reseller_discount_percent: Number(l.reseller_discount_percent),
      reseller_commission_percent: Number(l.reseller_commission_percent),
      welcome_points: Number(l.welcome_points),
    });
    toast.success("Enregistré");
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="cyber-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold">Programme fidélité</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.active} onChange={(e) => set("active", e.target.checked)}/> Programme activé</label>
        <label className="block text-xs text-slate-400">Points gagnés par HTG dépensé<input type="number" step="0.01" className="input mt-1" value={l.points_per_htg} onChange={(e) => set("points_per_htg", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">HTG obtenus par point échangé<input type="number" step="0.01" className="input mt-1" value={l.htg_per_point} onChange={(e) => set("htg_per_point", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Points minimum pour échanger<input type="number" className="input mt-1" value={l.min_redeem_points} onChange={(e) => set("min_redeem_points", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Points de bienvenue<input type="number" className="input mt-1" value={l.welcome_points} onChange={(e) => set("welcome_points", e.target.value)}/></label>
      </div>
      <div className="cyber-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold">Programme Revendeur</h3>
        <label className="block text-xs text-slate-400">Réduction revendeur (%)<input type="number" step="0.1" className="input mt-1" value={l.reseller_discount_percent} onChange={(e) => set("reseller_discount_percent", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Commission revendeur (%)<input type="number" step="0.1" className="input mt-1" value={l.reseller_commission_percent} onChange={(e) => set("reseller_commission_percent", e.target.value)}/></label>
        <div className="text-xs text-slate-400 mt-2">Les revendeurs bénéficient d'une réduction automatique sur chaque commande. Activez ce statut par client dans l'onglet Revendeurs.</div>
      </div>
      <div className="lg:col-span-2"><button data-testid="save-loyalty" onClick={save} className="btn-primary">Enregistrer les modifications</button></div>
      <InputStyles/>
    </div>
  );
}

// ------ RESELLERS
function Resellers() {
  const [customers, setCustomers] = useState([]);
  const [email, setEmail] = useState("");
  const load = () => api.get("/admin/customers").then((r) => setCustomers(r.data));
  useEffect(() => { load(); }, []);
  const toggle = async (em, on) => {
    await api.post(`/admin/customers/${encodeURIComponent(em)}/reseller`, { is_reseller: on });
    toast.success(on ? "Promu revendeur" : "Retiré des revendeurs");
    load();
  };
  const add = async () => { if (email) { await toggle(email.toLowerCase(), true); setEmail(""); }};
  return (
    <div>
      <div className="cyber-card rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <input data-testid="reseller-email" className="input flex-1" placeholder="email client à promouvoir" value={email} onChange={(e) => setEmail(e.target.value)}/>
        <button data-testid="add-reseller" onClick={add} className="btn-primary">Ajouter</button>
      </div>
      <div className="cyber-card rounded-2xl overflow-x-auto thin-scroll">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-slate-400"><tr><th className="p-3">Email</th><th className="p-3">Nom</th><th className="p-3">Commandes</th><th className="p-3">Total dépensé</th><th className="p-3">Action</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.phone || c.email} className="border-t border-white/5">
                <td className="p-3 font-mono-a">{c.email || "—"}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.orders_count}</td>
                <td className="p-3 font-mono-a">{formatHTG(c.total_spent)}</td>
                <td className="p-3">{c.email && <button onClick={() => toggle(c.email, true)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs">Revendeur</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InputStyles/>
    </div>
  );
}

// ------ MESSAGES (contact)
function Messages() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/contact-messages").then((r) => setItems(r.data)); }, []);
  return (
    <div className="space-y-3">
      {items.length === 0 && <div className="cyber-card rounded-2xl p-6 text-center text-slate-400">Aucun message.</div>}
      {items.map((m) => (
        <div key={m.id} className="cyber-card rounded-2xl p-4">
          <div className="flex justify-between text-sm">
            <div><b>{m.name}</b> · <span className="font-mono-a text-slate-400">{m.email}</span></div>
            <div className="text-xs text-slate-500">{formatDate(m.created_at)}</div>
          </div>
          {m.subject && <div className="text-sm font-semibold mt-1">{m.subject}</div>}
          <div className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{m.message}</div>
        </div>
      ))}
    </div>
  );
}

// ------ LOGS
function Logs() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/logs").then((r) => setItems(r.data)); }, []);
  return (
    <div className="cyber-card rounded-2xl overflow-x-auto thin-scroll">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
          <tr><th className="p-3">Date</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Cible</th><th className="p-3">Détails</th></tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className="border-t border-white/5">
              <td className="p-3 text-xs text-slate-400">{formatDate(l.created_at)}</td>
              <td className="p-3 font-mono-a">{l.admin_email}</td>
              <td className="p-3"><span className="pill status-completed">{l.action}</span></td>
              <td className="p-3 font-mono-a text-[#00F0FF]">{l.target}</td>
              <td className="p-3 text-xs text-slate-400">{Object.keys(l.details || {}).length ? JSON.stringify(l.details) : "—"}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucune action enregistrée.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---- shared
function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="cyber-card rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto thin-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold">{title}</h3>
          <button onClick={onClose} data-testid="modal-close" className="p-1.5 rounded bg-white/5 hover:bg-white/10"><X className="w-4 h-4"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-mono-a mt-0.5 break-all">{value}</div>
    </div>
  );
}
function InputStyles() {
  return <style>{`.input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 12px;color:#F8FAFC;outline:none;font-size:14px}.input:focus{border-color:rgba(0,240,255,0.5)}`}</style>;
}
