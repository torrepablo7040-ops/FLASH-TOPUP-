import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { LogIn, ShieldCheck, Zap } from "lucide-react";

export default function CustomerLogin() {
  const { customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/mon-compte";

  useEffect(() => {
    if (!loading && customer) navigate(returnTo);
  }, [customer, loading, navigate, returnTo]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + `/auth/customer?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="cyber-card rounded-3xl p-8 sm:p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center mx-auto glow-cyan-sm">
          <LogIn className="w-8 h-8 text-[#00F0FF]"/>
        </div>
        <h1 className="font-display text-2xl font-extrabold mt-4 uppercase">Espace Client</h1>
        <p className="text-slate-400 text-sm mt-2">Connectez-vous avec Google pour passer commande et suivre vos transactions.</p>
        <button data-testid="customer-google-login" onClick={login} className="btn-primary mt-6 w-full inline-flex items-center justify-center gap-2">
          <Zap className="w-4 h-4"/> Continuer avec Google
        </button>
        <div className="mt-6 flex items-start gap-2 text-left text-xs text-slate-400 bg-white/5 border border-white/10 rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-[#00F0FF] mt-0.5"/>
          <span>Aucun mot de passe demandé. Vos données restent privées et vos commandes sont liées à votre compte Google.</span>
        </div>
        <Link to="/" className="mt-6 inline-block text-sm text-slate-400 hover:text-white">← Retour à l'accueil</Link>
      </div>
    </div>
  );
}
