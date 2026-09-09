import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const SLIDE_DURATION = 6500;

export function HeroSlideshow({ images }: { images: string[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const preloadRef = useRef(new Map<string, Promise<boolean>>());
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const playing = !paused && !reduced && visible && pageVisible;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => setReduced(media.matches);
    const visibilityChanged = () => setPageVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    if (hostRef.current) observer.observe(hostRef.current);
    media.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  useEffect(() => {
    if (!playing || images.length < 2) return;
    let cancelled = false;
    const preload = (src: string) => {
      let promise = preloadRef.current.get(src);
      if (!promise) {
        promise = new Promise<boolean>((resolve) => {
          const image = new Image();
          image.onload = () => { image.decode().then(() => resolve(true), () => resolve(false)); };
          image.onerror = () => resolve(false);
          image.src = src;
        });
        preloadRef.current.set(src, promise);
      }
      return promise;
    };
    // Decode the next photo during the dwell time, before revealing it.
    void preload(images[(current + 1) % images.length]);
    const timer = window.setTimeout(async () => {
      for (let offset = 1; offset < images.length; offset++) {
        const next = (current + offset) % images.length;
        const ready = await preload(images[next]);
        if (cancelled) return;
        if (ready) { setPrevious(current); setCurrent(next); return; }
      }
    }, SLIDE_DURATION);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [current, images, playing]);

  if (!images.length) return null;

  return (
    <div ref={hostRef} className="hero-slideshow" data-playing={playing} data-slide={current}>
      <div className="hero-slideshow-images" aria-hidden="true">
        {images.map((src, index) => (
          <div key={src} className="hero-slide" data-active={index === current} data-retained={index === previous}>
            {(index === current || index === previous) && (
              <img
                src={src}
                alt=""
                width="1376"
                height="768"
                loading="eager"
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
                className="hero-slide-image"
                style={{ animationDirection: index % 2 ? "reverse" : "normal" }}
              />
            )}
          </div>
        ))}
        <div className="hero-slideshow-shade" />
      </div>
      {!reduced && images.length > 1 && (
        <button
          type="button"
          className="hero-slideshow-toggle"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? "Play background slideshow" : "Pause background slideshow"}
          title={paused ? "Play slideshow" : "Pause slideshow"}
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
