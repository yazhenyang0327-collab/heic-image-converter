# HEIC Image Converter

Static single-page HEIC converter with Cloudflare Turnstile validation through a Vercel Serverless Function.

## Turnstile production setup

1. In Cloudflare Turnstile, keep these hostnames on the widget:
   - `heicimageconverter.com`
   - `www.heicimageconverter.com` if the `www` hostname is used
   - `heic-tau.vercel.app`
2. Copy the widget **Secret key**. Never place it in `index.html` or commit it.
3. In Vercel, open the project and go to **Settings → Environment Variables**.
4. Add `TURNSTILE_SECRET_KEY` with the Cloudflare Secret key for the Production, Preview, and Development environments that need verification.
5. Optionally add `TURNSTILE_ALLOWED_HOSTNAMES` as a comma-separated list when the deployment uses different hostnames.
6. Redeploy after saving the environment variable.

The public Site key remains in `index.html`. The secret is read only by `api/verify-turnstile.js`.

## Verification flow

The browser runs the Turnstile challenge with the `convert` action. Its one-time token is sent to `/api/verify-turnstile`, which calls Cloudflare Siteverify and checks:

- Cloudflare returned success.
- The hostname is allowed.
- The action is `convert`.

File selection and drag-and-drop fail closed until the server returns success.
