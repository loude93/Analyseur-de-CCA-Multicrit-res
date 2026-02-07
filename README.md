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

### 1) Démarrer le backend
```bash
npm run dev:backend
```

Backend par défaut: `http://localhost:4000`.

### 2) Démarrer le frontend
```bash
npm run dev:frontend
```

Frontend par défaut: `http://localhost:3000`.

Le frontend proxifie automatiquement `/api/*` vers le backend (`:4000`).

## Build de production
```bash
npm run build
npm run preview
```

## Notes
- L'API Google Gemini est supprimée du projet.
- Le backend expose actuellement `GET /api/health`.
