import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Send, MessageCircle, Loader2, Mail } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => { api.get("/settings/public").then((r) => setSettings(r.data)); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const wa = (settings.whatsapp_support || "").replace(/[^0-9+]/g, "");

  const send = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || form.message.length < 10) return toast.error("Remplissez tous les champs (message min 10 caractères)");
    setSending(true);
    try {
      await api.post("/contact", form);
      toast.success("Message envoyé ! Nous vous répondrons rapidement.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur d'envoi");
    } finally { setSending(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase">Contact & Support</h1>
      <p className="text-slate-400 mt-2 mb-6 text-sm">Nous sommes là pour vous aider — réponse rapide via WhatsApp ou email.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {wa && (
          <a data-testid="contact-whatsapp" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="cyber-card rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-500/40">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-emerald-300"/></div>
            <div><div className="font-semibold">WhatsApp</div><div className="text-xs text-slate-400 font-mono-a">{settings.whatsapp_support}</div></div>
          </a>
        )}
        <div className="cyber-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center"><Mail className="w-5 h-5 text-[#00F0FF]"/></div>
          <div><div className="font-semibold">Email</div><div className="text-xs text-slate-400">Répondu sous 24h</div></div>
        </div>
      </div>

      <form onSubmit={send} className="cyber-card rounded-2xl p-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">Nom<input data-testid="contact-name" className="input mt-1" value={form.name} onChange={(e) => set("name", e.target.value)}/></label>
          <label className="block text-xs text-slate-400">Email<input data-testid="contact-email" type="email" className="input mt-1" value={form.email} onChange={(e) => set("email", e.target.value)}/></label>
        </div>
        <label className="block text-xs text-slate-400">Sujet<input data-testid="contact-subject" className="input mt-1" value={form.subject} onChange={(e) => set("subject", e.target.value)}/></label>
        <label className="block text-xs text-slate-400">Message<textarea data-testid="contact-message" className="input mt-1 min-h-32" value={form.message} onChange={(e) => set("message", e.target.value)}/></label>
        <button data-testid="contact-send" disabled={sending} className="btn-primary inline-flex items-center gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Envoyer
        </button>
      </form>
      <style>{`.input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 12px;color:#F8FAFC;outline:none;font-size:16px}.input:focus{border-color:rgba(0,240,255,0.5)}`}</style>
    </div>
  );
}
