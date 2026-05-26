# Solvan AI

Single-page marketing site. Static — no build step.

## Run locally

Any static server works. For example:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open http://localhost:8000

## Deploy

1. Push to GitHub
2. Import the repo at vercel.com → Framework Preset: **Other** → leave build/output empty → Deploy

## Files

- `index.html` — markup
- `styles.css` — all styling
- `main.js` — Three.js crystal, Lenis smooth scroll, GSAP reveals
- `vercel.json` — clean URL config
- `public/` — social/og images (optional)
