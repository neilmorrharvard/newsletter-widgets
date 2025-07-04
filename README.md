# Newsletter Widget

This repository contains:
- A frontend newsletter signup widget (for embedding in your site)
- A Cloudflare Worker backend (for handling API requests securely)

## Structure

```
frontend/        # Widget code (HTML, JS, CSS)
worker/          # Cloudflare Worker code and config
.github/workflows/ # (Optional) CI/CD automation
```

## Setup

### Frontend Widget
- Edit code in `frontend/widget.js` and `frontend/widget.css`.
- Use `frontend/index.html` for local testing.
- Deploy the built/minified widget to your static host (e.g., GitHub Pages).

### Cloudflare Worker
- Code and config in `worker/`.
- Deploy using [Wrangler](https://developers.cloudflare.com/workers/wrangler/):
  ```
  cd worker
  wrangler publish
  ```

### CI/CD (Optional)
- Add GitHub Actions workflows in `.github/workflows/` to automate deployments. 