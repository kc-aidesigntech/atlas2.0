# Atlas (ATLAS) 2026 Seeding Guide

Use this script to populate the canonical `atlas2026` collections used by the command center.

## Command

From the `scripts/` directory:

`npm run seed-atlas2026`

## Required Environment Variables

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_APP_ID` (defaults to `demo-app`)

The script loads `.env.local` first, then `.env`.

## Collections Seeded

- `artifacts/{appId}/atlas2026/participants/*`
- `artifacts/{appId}/atlas2026/capacityTopology/*`
- `artifacts/{appId}/atlas2026/ontology/weights`
- `artifacts/{appId}/atlas2026/ontologyAudit/*`
- `artifacts/{appId}/atlas2026/memoryEvents/*`

## Notes

- This script uses client Software Development Kit (SDK) auth with anonymous sign-in.
- It is safe for iterative development; most writes are `setDoc(..., { merge: true })`.

