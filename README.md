# persian-news-react

Persian-language reader for the latest headlines from **BBC Persian** (bbc.com/persian), built with **React + Vite + TypeScript**.

## How it works

Browsers can't fetch BBC Persian directly (CORS), so the news is fetched at build time:

1. A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs **every 30 minutes**, on every push to `main`, and on demand.
2. `scripts/fetch-news.mjs` downloads the latest news and writes `public/news.json`.
3. The app is built and deployed to **GitHub Pages**. The page reloads `news.json` every 5 minutes.

If fetching fails, the workflow fails and the previously deployed version stays online.

Source: the official BBC Persian RSS feed `https://feeds.bbci.co.uk/persian/rss.xml`.

## One-time setup on GitHub

Repository **Settings → Pages → Build and deployment → Source: "GitHub Actions"**, then run the workflow once (Actions tab → *Fetch news and deploy* → *Run workflow*).

## Local development

```bash
npm install
npm run fetch-news   # writes public/news.json
npm run dev
```

## Limitations

- News is at most ~30 minutes old, and GitHub can delay scheduled runs at busy times.
- GitHub disables scheduled workflows in public repos after 60 days without repository activity; re-enable it from the Actions tab.
- All content belongs to BBC Persian; this project only shows headlines that link back to the original articles.
