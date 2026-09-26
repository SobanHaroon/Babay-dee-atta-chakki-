The redesign preserves the navy, blue, amber and cream palette, store information, and shopping flows. It introduces Cormorant Garamond / DM Sans typography, optimized local WebP photographs, and a cinematic Three.js workshop scene. Scroll controls a restrained camera move; slow mill rotation, grain and flour flow run at a maximum of 30 frames per second, with a pause control. The scene loads near the viewport, stops rendering offscreen or in hidden tabs, and falls back to a still image for reduced motion or unavailable WebGL.

Production configuration still needs to be verified before deployment:

- Set a server-only `ADMIN_API_TOKEN` with at least 32 random characters. Admin, notification, email diagnostics and order status mutation endpoints now require `Authorization: Bearer …` and fail closed without it. Never embed this token in the frontend.
- Set `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` on the server. Apply the accompanying `scripts/secure-orders.sql` to restrict direct order-table access. The browser's publishable key must have no access to customer orders. Database privileges were not inspected or changed remotely during this work.
- Rotate the previously hardcoded map keys and the old public notification topic. Map provider credentials now come from environment variables. Browser map keys must have provider-side origin and API restrictions; use separate server-side keys. Ntfy notifications require `NTFY_TOPIC` and `NTFY_TOKEN` and a private topic with anonymous access denied at the provider. Merely setting a token does not make an existing public topic private.
- Configure exact staging origins with `ALLOWED_ORIGINS`. Only set `TRUST_PROXY_HOPS` for your deployment's known proxy topology. The built-in request limiter is per process; use the host's shared WAF/rate limiting for distributed deployments and abuse protection across instances.
- Serve HTTPS. Express and Vercel both set CSP, clickjacking, MIME sniffing, referrer and permissions headers. The `dist/client` directory is the only public build output; server bundles and maps stay outside it. Use `NODE_ENV=production` when running the Node server.
- Order access requires the order ID and checkout phone number. This is a practical improvement over public sequential-ID lookups, not equivalent to account authentication or OTP. Stronger identity verification and shared rate limits are recommended for a high-volume deployment.
- Real email/SMS dispatch, payment providers, live database policies, Search Console indexing and field Core Web Vitals require deployment credentials and live-environment validation. Browser tests use a fixture catalog and do not submit a live order.

Validation commands:

```
npm run lint
npm run build
npm run test:security
npm run test:browser
npm audit
```

Browser verification saves desktop/mobile screenshots and a machine-readable report in `artifacts/redesign`. It checks responsive overflow, headings, the WebGL scene, reduced-motion fallback and navigation. The headless Chrome path in the script targets Windows.

SEO changes include crawlable main navigation and category/product links, canonical URLs, search query deep links, primary headings, absolute social preview URLs, a noscript store summary and consistent local-business coordinates. Unverified aggregate ratings and hardcoded product offers were removed from structured data. The app is still client-rendered; rankings and a perfect Lighthouse score are not guaranteed. Product data is fetched at runtime; server rendering or prerendering would be a separate infrastructure improvement.

Implementation references: [Express production security](https://expressjs.com/en/advanced/best-practice-security/) and [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
