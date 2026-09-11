import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { ProductCard } from "./Home";

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const activeCat = params.get("cat") || "";

  useEffect(() => {
    api.get("/categories").then((r) => setCats(r.data));
  }, []);

  useEffect(() => {
    const url = activeCat ? `/products?category_id=${activeCat}` : "/products";
    api.get(url).then((r) => setProducts(r.data));
  }, [activeCat]);

  const filtered = products.filter((p) =>
    !q ? true : p.name.toLowerCase().includes(q.toLowerCase())
  );

  const setCat = (id) => {
    const np = new URLSearchParams(params);
    if (id) np.set("cat", id); else np.delete("cat");
    setParams(np);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase">Produits</h1>
          <p className="text-slate-400 text-sm mt-1">Choisissez votre jeu et rechargez en quelques clics.</p>
        </div>
        <input
          data-testid="products-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit..."
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm outline-none focus:border-[#00F0FF]/60 w-full sm:w-72"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto thin-scroll pb-3 -mx-1 px-1 mb-6">
        <button
          data-testid="cat-pill-all"
          onClick={() => setCat("")}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${
            !activeCat ? "bg-[#00F0FF] text-[#0A0C10] border-transparent" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
          }`}
        >Tous</button>
        {cats.map((c) => (
          <button
            key={c.id}
            data-testid={`cat-pill-${c.slug}`}
            onClick={() => setCat(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${
              activeCat === c.id ? "bg-[#00F0FF] text-[#0A0C10] border-transparent" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >{c.name}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="cyber-card rounded-2xl p-10 text-center text-slate-400">Aucun produit trouvé.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
