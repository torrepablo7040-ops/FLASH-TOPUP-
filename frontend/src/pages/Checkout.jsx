import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { formatHTG } from "@/lib/format";
import { toast } from "sonner";
import { Copy, Upload, CheckCircle2, Loader2, LogIn } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function Checkout() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { customer, loading: authLoading } = useCustomerAuth();
  const [product, setProduct] = useState(null);
  const [settings, setSettings] = useState({});
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/connexion?returnTo=${encodeURIComponent(`/commander/${productId}`)}`);
    }
  }, [customer, authLoading, navigate, productId]);

  const [form, setForm] = useState({
    quantity: 1,
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    game_id: "",
    delivery_info: "",
    payment_method: "moncash",
    proof_image_url: "",
    transaction_id: "",
  });

  useEffect(() => {
    if (customer) setForm((f) => ({ ...f, customer_name: f.customer_name || customer.name || "", customer_email: customer.email }));
  }, [customer]);

  useEffect(() => {
    api.get(`/products/${productId}`).then((r) => setProduct(r.data)).catch(() => toast.error("Produit introuvable"));
    api.get("/settings/public").then((r) => setSettings(r.data));
  }, [productId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (authLoading || !customer) return <div className="p-10 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin inline"/></div>;
  if (!product) return <div className="p-10 text-center text-slate-400">Chargement…</div>;

  const total = (product.price || 0) * Math.max(1, Number(form.quantity) || 1);
  const method = form.payment_method;
  const benName = method === "moncash" ? settings.moncash_beneficiary : settings.natcash_beneficiary;
  const benNum = method === "moncash" ? settings.moncash_number : settings.natcash_number;

  const copy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("proof_image_url", r.data.url);
      toast.success("Preuve uploadée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec upload");
    } finally {
      setUploading(false);
    }
  };

  const validateStep1 = () => {
    if (!form.customer_name.trim()) return "Nom requis";
    if (!form.customer_phone.trim()) return "Téléphone requis";
    if (!form.game_id.trim()) return "ID du jeu requis";
    return null;
  };
  const validateStep2 = () => {
    if (!benNum) return "Le bénéficiaire n'a pas configuré ce moyen. Choisissez l'autre.";
    return null;
  };
  const validateStep3 = () => {
    if (!form.proof_image_url) return "Photo de preuve requise";
    if (!form.transaction_id.trim()) return "ID de transaction requis";
    return null;
  };

  const submit = async () => {
    const errs = validateStep1() || validateStep2() || validateStep3();
    if (errs) return toast.error(errs);
    setSubmitting(true);
    try {
      const r = await api.post("/orders", {
        product_id: product.id,
        quantity: Number(form.quantity) || 1,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        game_id: form.game_id,
        delivery_info: form.delivery_info,
        payment_method: form.payment_method,
        proof_image_url: form.proof_image_url,
        transaction_id: form.transaction_id,
      });
      navigate(`/confirmation/${r.data.order_number}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la commande");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase mb-1">Passer commande</h1>
      <p className="text-slate-400 text-sm mb-4">Connecté en tant que <b className="text-slate-200">{customer.email}</b> · Suivez les étapes.</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-2 rounded-full flex-1 ${step >= n ? "bg-[#00F0FF]" : "bg-white/10"}`} />
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 cyber-card rounded-2xl p-5 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display font-bold">1. Informations de livraison</h2>
              <FieldRow label="Nom complet *">
                <input data-testid="co-name" className="input" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </FieldRow>
              <div className="grid sm:grid-cols-2 gap-3">
                <FieldRow label="Téléphone *">
                  <input data-testid="co-phone" className="input" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="+509 ..." />
                </FieldRow>
                <FieldRow label="Email (compte Google)">
                  <input data-testid="co-email" className="input opacity-70" value={form.customer_email} readOnly />
                </FieldRow>
              </div>
              <FieldRow label="ID du jeu / Player ID *">
                <input data-testid="co-gameid" className="input" value={form.game_id} onChange={(e) => set("game_id", e.target.value)} placeholder="Ex: 1234567890" />
              </FieldRow>
              <FieldRow label="Informations complémentaires (optionnel)">
                <textarea data-testid="co-delivery" className="input min-h-24" value={form.delivery_info} onChange={(e) => set("delivery_info", e.target.value)} />
              </FieldRow>
              <FieldRow label="Quantité">
                <input data-testid="co-qty" type="number" min={1} className="input w-32" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
              </FieldRow>
              <div className="flex justify-end">
                <button data-testid="co-step1-next" onClick={() => { const e = validateStep1(); if (e) return toast.error(e); setStep(2); }} className="btn-primary">Continuer</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display font-bold">2. Choisir le mode de paiement</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  data-testid="co-pay-moncash"
                  onClick={() => set("payment_method", "moncash")}
                  className={`cyber-card rounded-2xl p-4 text-left transition ${method === "moncash" ? "border-[#FF8C00] glow-amber" : ""}`}
                >
                  <div className="font-mono-a text-xs uppercase text-[#FF8C00]">MonCash</div>
                  <div className="font-display font-bold mt-1">Digicel</div>
                </button>
                <button
                  data-testid="co-pay-natcash"
                  onClick={() => set("payment_method", "natcash")}
                  className={`cyber-card rounded-2xl p-4 text-left transition ${method === "natcash" ? "border-[#E60028] glow-crimson" : ""}`}
                >
                  <div className="font-mono-a text-xs uppercase text-[#E60028]">NatCash</div>
                  <div className="font-display font-bold mt-1">Natcom</div>
                </button>
              </div>
              <div className="cyber-card rounded-2xl p-4">
                <div className="text-xs uppercase text-slate-400 font-mono-a">Envoyez à</div>
                <div className="mt-2 space-y-2">
                  <Row label="Bénéficiaire" value={benName || "—"} />
                  <Row label="Numéro" value={benNum || "—"} onCopy={() => copy(benNum)} />
                  <Row label="Montant" value={formatHTG(total)} onCopy={() => copy(String(total))} />
                </div>
                <div className="mt-3 text-sm text-slate-300">{settings.payment_instructions}</div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white">← Retour</button>
                <button data-testid="co-step2-next" onClick={() => { const e = validateStep2(); if (e) return toast.error(e); setStep(3); }} className="btn-primary">Continuer</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display font-bold">3. Preuve de paiement</h2>
              <FieldRow label="Photo de la transaction *">
                <label className="cyber-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer border-dashed">
                  <input
                    data-testid="co-proof-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]"/> : form.proof_image_url ? (
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${form.proof_image_url}`} alt="proof" className="max-h-40 rounded"/>
                  ) : (
                    <><Upload className="w-6 h-6 text-slate-400"/><span className="text-sm text-slate-300">Cliquez pour uploader</span></>
                  )}
                </label>
              </FieldRow>
              <FieldRow label="ID de transaction *">
                <input data-testid="co-txid" className="input" value={form.transaction_id} onChange={(e) => set("transaction_id", e.target.value)} placeholder="Ex: MT12345678" />
              </FieldRow>
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="text-slate-400 hover:text-white">← Retour</button>
                <button data-testid="co-submit-btn" onClick={submit} disabled={submitting} className="btn-primary inline-flex items-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} Confirmer ma commande
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="cyber-card rounded-2xl p-5 h-fit">
          <div className="text-xs uppercase text-slate-400 font-mono-a">Récapitulatif</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5">
              {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{product.name}</div>
              <div className="text-xs text-slate-400">{formatHTG(product.price)} × {form.quantity || 1}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-slate-300">Total</div>
            <div className="font-mono-a font-extrabold text-[#00F0FF] text-lg">{formatHTG(total)}</div>
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:12px 14px;color:#F8FAFC;outline:none;font-size:16px}.input:focus{border-color:rgba(0,240,255,0.5)}`}</style>
    </div>
  );
}

const FieldRow = ({ label, children }) => (
  <label className="block">
    <span className="text-xs text-slate-400 mb-1 block">{label}</span>
    {children}
  </label>
);

const Row = ({ label, value, onCopy }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="flex items-center gap-2 font-mono-a">
      <span className="truncate max-w-[16rem]">{value}</span>
      {onCopy && <button onClick={onCopy} className="text-[#00F0FF] hover:opacity-80"><Copy className="w-4 h-4"/></button>}
    </span>
  </div>
);
