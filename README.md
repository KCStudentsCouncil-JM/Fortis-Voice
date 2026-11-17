# Fortis Voice — Kingston College Students' Council Petitions Platform

Official student petitions, verified Fortis voices, and accountable council action portal built with React, TypeScript, Vite, Tailwind CSS v4, Firebase Firestore/Auth, and Progressive Web App (PWA) offline support.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server on port 3000:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Deploying to GitHub Pages

This repository includes a pre-configured workflow (`.github/workflows/deploy-pages.yml`) and subpath-safe Vite build configuration (`base`, PWA manifest, relative assets, `.nojekyll`, and `404.html` fallback).

1. Push this repository to GitHub (default branch `main`).
2. In GitHub, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. The workflow automatically builds `dist/` with the repository's base path and publishes your site at `https://<your-username>.github.io/<repo-name>/`.
4. **If using Live Firebase Mode on GitHub Pages**: open **Firebase Console → Authentication → Settings → Authorized domains** and add `<your-username>.github.io` so Google Sign-In works from your GitHub Pages URL.

## Authentication & Persistence Modes

- **Live Firebase Mode**: Uses `firebase-applet-config.json` with Firebase Google Authentication and Cloud Firestore enforced by `firestore.rules`.
- **Local Demo Mode**: Browser-scoped fallback store (`LocalDemoRepository`) preloaded with Kingston College seed data and quick role previews (`Visitor`, `Member`, `Verified Organiser`, `Moderator`, `Pending`, `Rejected`). Local Demo Mode is explicitly labelled in the interface and is for demonstration only—not server-enforced security.

## Customizing Platform Identity

Edit `src/config/brand.ts` (`BRAND_CONFIG`) to rename the platform, update the tagline/mission, or adjust petition categories in one place.
