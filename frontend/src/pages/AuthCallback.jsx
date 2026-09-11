import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) { navigate("/admin/login"); return; }

    (async () => {
      try {
        const r = await api.post("/auth/session", { session_id: sessionId });
        setUser(r.data.user);
        // clean hash
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/admin");
      } catch (e) {
        toast.error(e.response?.data?.detail || "Échec authentification");
        navigate("/admin/login");
      }
    })();
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-300">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF]"/> Connexion en cours…
      </div>
    </div>
  );
}
