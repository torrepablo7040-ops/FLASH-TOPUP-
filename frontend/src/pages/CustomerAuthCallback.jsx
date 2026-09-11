import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setCustomer } = useCustomerAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;
    if (!sessionId) { navigate("/connexion"); return; }
    (async () => {
      try {
        const r = await api.post("/customer/auth/session", { session_id: sessionId });
        setCustomer(r.data.user);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(params.get("returnTo") || "/mon-compte");
      } catch (e) {
        toast.error("Échec authentification");
        navigate("/connexion");
      }
    })();
  }, [location, navigate, setCustomer, params]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center text-slate-300">
      <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] mr-2"/> Connexion en cours…
    </div>
  );
}
