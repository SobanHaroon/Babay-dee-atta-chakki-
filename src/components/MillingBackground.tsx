import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";
import { millingStage } from "../lib/millingProgress";

gsap.registerPlugin(ScrollTrigger);

/** Outside the page-transition wrapper: transforms would trap a fixed background. */
export function MillingBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const main = host?.closest("main");
    if (!host || !canvas || !main) return;

    let disposed = false;
    let renderFrame = 0;
    let refreshFrame = 0;
    let progress = 0;
    let visible = true;
    let scene: Awaited<ReturnType<typeof import("../lib/millingScene").createMillingScene>> | undefined;
    let trigger: ScrollTrigger | undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const render = () => {
      renderFrame = 0;
      if (disposed || !visible || document.hidden || reducedMotion.matches || !scene) return;
      scene.render(progress);
      host.dataset.progress = progress.toFixed(5);
      host.dataset.stage = millingStage(progress);
      host.dataset.ready = "true";
    };
    const requestRender = () => {
      if (!renderFrame && !disposed) renderFrame = requestAnimationFrame(render);
    };
    const refresh = () => {
      if (refreshFrame || disposed) return;
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;
        trigger?.refresh();
        requestRender();
      });
    };
    const resize = () => {
      scene?.resize(host.clientWidth, host.clientHeight);
      refresh();
    };

    async function start() {
      if (reducedMotion.matches || disposed) return;
      try {
        if (!scene) {
          const { createMillingScene } = await import("../lib/millingScene");
          if (disposed || reducedMotion.matches) return;
          scene = createMillingScene(canvas!);
          scene.resize(host!.clientWidth, host!.clientHeight);
        }
        if (!trigger) {
          trigger = ScrollTrigger.create({
            id: "milling-background",
            trigger: main,
            start: "top top",
            end: "bottom bottom",
            invalidateOnRefresh: true,
            // Direct progress, without time-based easing or pinning the foreground.
            onUpdate: (self) => { progress = self.progress; requestRender(); },
            onRefresh: (self) => { progress = self.progress; requestRender(); },
          });
          progress = trigger.progress;
        }
        requestRender();
      } catch (error) {
        // Keep the photograph visible when WebGL is unavailable.
        host!.dataset.ready = "false";
        console.warn("Milling background is using its still-image fallback.", error);
      }
    }

    const motionChanged = () => {
      if (reducedMotion.matches) {
        trigger?.kill();
        trigger = undefined;
        cancelAnimationFrame(renderFrame);
        renderFrame = 0;
        scene?.dispose();
        scene = undefined;
        host.dataset.ready = "false";
        host.dataset.stage = "still";
      } else void start();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      host.dataset.ready = "false";
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestRender();
    });
    intersection.observe(main);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(main);
    resizeObserver.observe(host);
    reducedMotion.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", requestRender);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", requestRender);
    document.fonts.ready.then(() => { if (!disposed) refresh(); });
    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(renderFrame);
      cancelAnimationFrame(refreshFrame);
      trigger?.kill();
      intersection.disconnect();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", requestRender);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", requestRender);
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className="milling-background" aria-hidden="true" data-stage="still" data-ready="false">
      <canvas ref={canvasRef} className="milling-background-canvas" />
      <div className="milling-background-wash" />
    </div>
  );
}
