import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QA = [
  { q: "Combien de temps prend la livraison ?", a: "En général entre 2 et 5 minutes après validation du paiement par un administrateur. Les heures de pointe peuvent rallonger le délai jusqu'à 15 minutes." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Uniquement MonCash (Digicel) et NatCash (Natcom) pour l'instant. Les numéros du bénéficiaire s'affichent au moment de la commande." },
  { q: "Que faire si ma commande est en attente depuis plus de 30 minutes ?", a: "Contactez notre support WhatsApp avec votre numéro de commande (FT-XXXXXXXX). Nous vérifions immédiatement le paiement." },
  { q: "Ma commande a été refusée, pourquoi ?", a: "L'administrateur laisse toujours une raison visible dans votre espace Mon compte. Les causes fréquentes: preuve illisible, ID de transaction incorrect, montant erroné." },
  { q: "Où trouver mon ID de joueur (Player ID) ?", a: "Ouvrez votre jeu, allez dans votre profil. Le Player ID est un identifiant numérique unique. Pour PUBG: profil → basique. Pour Free Fire: en haut à côté de votre avatar." },
  { q: "Puis-je annuler une commande ?", a: "Une commande En attente peut être annulée si le paiement n'a pas encore été envoyé. Contactez le support WhatsApp." },
  { q: "Mes données Google sont-elles en sécurité ?", a: "Nous n'accédons qu'à votre email et votre nom via Google Sign-In. Aucun mot de passe ni donnée sensible n'est stocké." },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase">FAQ</h1>
      <p className="text-slate-400 mt-2 mb-6 text-sm">Réponses aux questions les plus fréquentes.</p>
      <div className="space-y-2">
        {QA.map((it, i) => (
          <div key={i} data-testid={`faq-item-${i}`} className="cyber-card rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between p-4 text-left">
              <span className="font-semibold">{it.q}</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${open === i ? "rotate-180 text-[#00F0FF]" : "text-slate-400"}`}/>
            </button>
            {open === i && <div className="px-4 pb-4 text-sm text-slate-300 leading-relaxed">{it.a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
