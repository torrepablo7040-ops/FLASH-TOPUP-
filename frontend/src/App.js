import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import MyOrders from "@/pages/MyOrders";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AuthCallback from "@/pages/AuthCallback";
import CustomerLogin from "@/pages/CustomerLogin";
import CustomerAuthCallback from "@/pages/CustomerAuthCallback";
import CustomerDashboard from "@/pages/CustomerDashboard";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";

function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) {
    if (location.pathname.startsWith("/auth/customer")) return <CustomerAuthCallback />;
    return <AuthCallback />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/produits" element={<Products />} />
        <Route path="/produits/:id" element={<ProductDetail />} />
        <Route path="/commander/:productId" element={<Checkout />} />
        <Route path="/confirmation/:orderNumber" element={<OrderConfirmation />} />
        <Route path="/mes-commandes" element={<MyOrders />} />
        <Route path="/connexion" element={<CustomerLogin />} />
        <Route path="/auth/customer" element={<CustomerAuthCallback />} />
        <Route path="/mon-compte" element={<CustomerDashboard />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CustomerAuthProvider>
            <AppRouter />
            <Toaster theme="dark" richColors position="top-right" />
          </CustomerAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
