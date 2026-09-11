# FLASH-Topup PRD

## Problème
Plateforme e-commerce haïtienne de recharges gaming/digitales (DLS, eFootball, PUBG Mobile, Free Fire, FC Mobile, CapCut Pro) en HTG. Paiement MonCash/NatCash. Admin via Google OAuth (torrepablo7040@gmail.com super admin). Client via Google OAuth obligatoire.

## Architecture
- Backend FastAPI + MongoDB
- Frontend React + Tailwind (thème obsidian gaming, Unbounded font)
- Emergent Google OAuth (admin + client séparés)
- Emergent Object Storage (uploads produits + preuves)
- Resend (emails, skip si pas de clé)

## Implémenté (Feb 2026)
- Homepage, Produits, ProductDetail, Checkout 3 étapes, Confirmation
- Mes commandes (lookup public), FAQ, Contact
- Espace client Google OAuth: /connexion, /mon-compte avec KPIs, notifications live (polling 15s), historique commandes filtrable
- Admin: login Google + bootstrap super_admin, dashboard (Aperçu, Commandes, Produits, Catégories, Bannières, Paiements, Clients, Messages, Historique, Admins)
- Marge % éditable, config MonCash/NatCash, upload images, allowlist admins
- Actions admin loggées (admin_logs) — visibles onglet Historique
- Sécurité: anti-double transaction_id, anti-spam (5 commandes/10min par client, 1 contact/60s par IP), validation min longueur, orders bloquées sans auth client
- Notifications automatiques: emails Resend (si clé) + in-app notifications table + WhatsApp support flottant

## Backlog
- P1: Notifications push web
- P2: Multi-langue (Kreyòl)
- P2: Programme de fidélité / codes promo
- P2: Rapports revenus par période / export CSV
