# Analyseur de CCA Multicritères (Maroc)

Application React/TypeScript pour simuler les intérêts d'un Compte Courant d'Associé (CCA) avec:
- calcul **mensuel** ou **journalier**,
- ventilation en 2 parts (personne morale / personne physique),
- calculs TVA, RAS, net,
- exports **Excel** et **PDF** (détail + accrue mensuelle).

## Prérequis
- Node.js 20+
- npm 10+

## Installation
```bash
npm install
```

## Lancer en développement
```bash
npm run dev
```

Par défaut, Vite démarre sur `http://localhost:3000`.

## Build de production
```bash
npm run build
npm run preview
```

## Notes
- La configuration Vite expose actuellement `GEMINI_API_KEY` au front (`process.env.*`).
- Pour un usage production, privilégier un proxy/backend pour les appels IA sensibles.
