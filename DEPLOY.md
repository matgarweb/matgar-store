# Deploy

Cloudflare Pages does not compile the /functions directory on dashboard (zip) uploads, and wrangler 4 `pages deploy` needs the prebuilt worker.

```
cd <repo checkout>
npx wrangler pages functions build functions --outdir /tmp/worker-out
cp /tmp/worker-out/index.js _worker.js   # put _worker.js at the site root of the upload dir
npx wrangler pages deploy <dir> --project-name=matgar-store --branch=main --no-bundle
```

Needs CLOUDFLARE_API_TOKEN (Pages Write on the account) and CLOUDFLARE_ACCOUNT_ID.
Do not commit _worker.js; it is a build artifact.
