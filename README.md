# FUNDED. — Suivi Prop Firm

Appli de suivi de comptes prop firm (firmes, comptes, scaling, dépenses, payouts,
objectifs de financement en paliers) connectée à Supabase.

## 1. Configurer Supabase

1. Ouvre ton projet sur [supabase.com](https://supabase.com).
2. Va dans **SQL Editor** → **New query**, colle tout le contenu de
   `supabase/schema.sql`, puis exécute-le. Ça crée les tables, active la
   Row Level Security, et installe les fonctions de chiffrement des mots de passe.
3. Dans **Authentication → Providers**, vérifie que **Email** est activé.
4. Dans **Authentication → Settings**, tu peux désactiver "Confirm email" si tu
   veux te connecter immédiatement sans passer par un email de confirmation
   (pratique en usage perso).
5. Récupère tes clés dans **Project Settings → API** :
   - `Project URL`
   - `anon public` key

## 2. Configurer le projet

```bash
cp .env.example .env
```

Remplis `.env` avec tes clés :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ta-clé-anon
```

## 3. Installer et lancer en local

```bash
npm install
npm run dev
```

L'appli est disponible sur http://localhost:5173

## 4. Premier lancement

1. Crée ton compte (email + mot de passe) depuis l'écran de connexion.
2. Connecte-toi. L'appli te proposera de configurer le **2FA (TOTP)** — scanne
   le QR code avec Google Authenticator ou Authy. Tu peux aussi cliquer sur
   "Plus tard" et le faire ensuite.
3. Ajoute tes firmes (Comptes → Firmes & allocation max), puis tes comptes.
4. Si tu ajoutes des identifiants de connexion à un compte, l'appli te demande
   de créer une **passphrase de chiffrement**. Cette passphrase n'est stockée
   nulle part — mémorise-la, elle sert à chiffrer/déchiffrer tes mots de passe
   côté base (pgcrypto). Si tu la perds, les mots de passe stockés deviennent
   irrécupérables (tu peux toujours les re-saisir).

## 5. Déployer (Vercel / Netlify)

**Vercel**
```bash
npm i -g vercel
vercel
```
Ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables
d'environnement du projet Vercel (Project → Settings → Environment Variables),
puis redéploie.

**Netlify**
```bash
npm run build
```
Dépose le dossier `dist/` (ou connecte ton repo Git), et ajoute les mêmes
variables d'environnement dans Site settings → Environment variables.

## Sécurité — à savoir

- Row Level Security est activée sur toutes les tables : tu ne peux voir/modifier
  que tes propres données, même via l'API Supabase brute.
- Les mots de passe de tes comptes prop firm sont chiffrés côté base avec
  `pgcrypto`. La passphrase de chiffrement n'est jamais stockée sur le serveur.
- Le 2FA (TOTP) protège la connexion à ton compte Supabase Auth.
- L'`anon key` est publique par design (elle est visible dans le code du
  navigateur) — la sécurité vient de la RLS, pas du secret de la clé.
