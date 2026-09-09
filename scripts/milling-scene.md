# Milling background

The homepage main body has a fixed, decorative Three.js background. The existing hero slideshow, cards, buttons and page layout remain in the foreground. Other tabs keep their existing backgrounds.

The five stages are wheat, natural stone grinding, sack filling/sealing, delivery to the customer, and the store shelf. Every object and camera position is sampled from the main body's scroll progress. There is no autoplay loop, added pinning, scroll interception or scroll easing. Scrolling backward evaluates the same scene in reverse. ResizeObserver refreshes the scroll range after lazy sections or existing pin spacers change page height.

The renderer is imported only for visitors who allow motion. It renders on demand, caps pixel density on mobile, pauses in hidden tabs, releases its resources on navigation, and uses `public/milling/grinding.webp` when reduced motion is requested or WebGL is unavailable. The preview images are local renders, not Higgsfield output.

## Generation status

Higgsfield Seedance 2.0 generation was attempted for the requested 15-second, 1080p, 16:9 cinematic sequence. The connected private workspace rejected it: **Out of credits on plus (monthly) plan**. No Higgsfield footage was created. The working procedural 3D scene is the fallback implementation. ThreeUI was not available in this session.

Suggested prompt for a future Higgsfield generation:

> A continuous 15-second photorealistic 3D journey, warm golden rim light and tactile natural materials, wide 16:9 with central action safe for portrait cropping. 0–3s: golden wheat kernels flow into a traditional two-stone granite chakki. 3–6s: upper stone rotates; fine flour emerges around the rim into a wooden chute. 6–9s: flour fills a tan jute sack with a small dark-green wheat emblem; its neck is tied with twine. 9–12s: the same sack travels in a small delivery vehicle and is handed to a Pakistani neighborhood grocery owner. 12–15s: the owner places it upright on a wooden store shelf. Smooth deliberate camera motion and plausible physical movement; consistent sack, scale, emblem and lighting. No captions or dialogue. Final composition rests on the sack.

## Preview and validation

With Vite running, open `/scripts/milling-preview.html` for the isolated 3D scene and progress slider. This development page is not part of the production build.

`node scripts/verify-milling.mjs` runs local headless Chrome on Windows, exports the five preview WebP files, and checks nonblank frames, deterministic reverse rendering, scroll synchronization, narrow/wide layouts, reduced motion and navigation cleanup. API reads are stubbed with empty arrays; this does not test live inventory or checkout. Screenshots and results go to `artifacts/milling/`.

Run `npm run lint` and `npm run build` for project checks.
