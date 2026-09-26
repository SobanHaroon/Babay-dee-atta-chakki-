/** Wait for a fresh, useful device fix; retain the best reading during acquisition. */
export function detectDeviceLocation(signal?: AbortSignal): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location detection is unavailable. Search your address or place the pin manually."));
    if (signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    let best: GeolocationPosition | undefined;
    let watch: number | undefined;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error);
      else if (best) resolve(best);
      else reject(new Error("Could not get a location fix. Enable device location or place the pin manually."));
    };
    const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => finish(), 15000);
    signal?.addEventListener("abort", cancel, { once: true });
    watch = navigator.geolocation.watchPosition(position => {
      if (!best || position.coords.accuracy < best.coords.accuracy) best = position;
      if (position.coords.accuracy <= 30) finish();
    }, error => {
      if (error.code === 1) finish(new Error("Location permission is blocked. Allow location in your browser, or search and place the pin manually."));
      else if (error.code !== 3) finish();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
