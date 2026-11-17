# CommonGround — Petitions & Civic Issues Platform

CommonGround is a general-purpose, community-agnostic civic petitions, campaign events, and official accountability platform built with React, TypeScript, Vite, Tailwind CSS v4, and Progressive Web App (PWA) offline support.

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

## Authentication & Persistence Modes

- **Live Firebase Mode**: Uses `firebase-applet-config.json` with Firebase Google Authentication and Cloud Firestore enforced by `firestore.rules`.
- **Local Demo Mode**: Browser-scoped fallback store (`LocalDemoRepository`) preloaded with general-purpose civic seed data and quick role previews (`Visitor`, `Member`, `Verified Organiser`, `Moderator`, `Pending`, `Rejected`). Local Demo Mode is explicitly labelled in the interface and is for demonstration only—not server-enforced security.

## Customizing Platform Identity

Edit `src/config/brand.ts` (`BRAND_CONFIG`) to rename the platform, update the tagline/mission, or adjust petition categories in one place.
