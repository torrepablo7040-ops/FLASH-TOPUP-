import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Zap } from "lucide-react";

export default function AdminLogin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/admin");
  }, [user, loading, navigate]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/admin";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="cyber-card rounded-3xl p-8 sm:p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center mx-auto glow-cyan-sm">
          <Shield className="w-8 h-8 text-[#00F0FF]"/>
        </div>
        <h1 className="font-display text-2xl font-extrabold mt-4 uppercase">Espace Administrateur</h1>
        <p className="text-slate-400 text-sm mt-2">Connexion réservée aux administrateurs autorisés.</p>
        <button
          data-testid="admin-google-login"
          onClick={login}
          className="btn-primary mt-6 w-full inline-flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4"/> Se connecter avec Google
        </button>
        <div className="mt-4 text-xs text-slate-500">
          Seuls les comptes Google présents dans la liste d'autorisation peuvent accéder.
        </div>
        <Link to="/" className="mt-6 inline-block text-sm text-slate-400 hover:text-white">← Retour à l'accueil</Link>
      </div>
    </div>
  );
}
