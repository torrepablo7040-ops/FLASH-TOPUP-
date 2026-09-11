import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const CustomerAuthCtx = createContext(null);

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const r = await api.get("/customer/auth/me");
      setCustomer(r.data);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/customer/auth/logout"); } catch {}
    setCustomer(null);
  };

  return (
    <CustomerAuthCtx.Provider value={{ customer, setCustomer, loading, checkAuth, logout }}>
      {children}
    </CustomerAuthCtx.Provider>
  );
};

export const useCustomerAuth = () => useContext(CustomerAuthCtx);
