import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, Wheat, Pause, Play } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);
const steps = [
  { title: 'Grain with a story', label: 'SOURCE', body: 'We start with carefully selected wheat and whole grains from trusted local harvests.' },
  { title: 'Slow stone pressure', label: 'MILL', body: "Traditional chakki milling keeps the process gentle, preserving the grain’s natural character." },
  { title: 'Fresh to your door', label: 'DELIVER', body: 'Your order is packed with care and dispatched across Rawalpindi and Islamabad while it is at its best.' },
];

export function ScrollMillingStory() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const resume = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let scene: ReturnType<typeof import('../lib/cinematicMill').createCinematicMill> | undefined;
    let trigger: ScrollTrigger | undefined;
    let loading = false;
    let visible = false;
    let frame = 0;
    let progress = 0;
    let easedProgress = 0;
    let seconds = 0;
    let lastTime = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const render = (timestamp: number) => {
      frame = 0;
      if (!scene || !visible || document.hidden || reduced.matches || disposed) { lastTime = 0; return; }
      const elapsed = lastTime ? timestamp - lastTime : 34;
      if (elapsed >= 32) {
        const dt = Math.min(elapsed / 1000, .07);
        lastTime = timestamp;
        if (!pausedRef.current) seconds += dt;
        easedProgress = pausedRef.current ? progress : easedProgress + (progress - easedProgress) * Math.min(1, dt * 6);
        scene.render(easedProgress, seconds);
        if (stage.current) stage.current.dataset.sceneTime = seconds.toFixed(3);
      }
      if (!pausedRef.current || Math.abs(progress - easedProgress) > .001) frame = requestAnimationFrame(render);
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
    resume.current = schedule;
    const resize = new ResizeObserver(() => { if (scene && stage.current) { scene.resize(stage.current.clientWidth, stage.current.clientHeight); schedule(); } });
    resize.observe(stage.current!);
    async function start() {
      if (loading || scene || disposed || reduced.matches || !visible) return;
      loading = true;
      try {
        const { createCinematicMill } = await import('../lib/cinematicMill');
        if (disposed || reduced.matches) return;
        scene = createCinematicMill(canvas.current!);
        scene.resize(stage.current!.clientWidth, stage.current!.clientHeight);
        trigger = ScrollTrigger.create({ trigger: section.current, start: 'top 70%', end: 'bottom 30%', onUpdate: self => { progress = self.progress; schedule(); }, onRefresh: self => { progress = self.progress; schedule(); } });
        progress = trigger.progress;
        easedProgress = progress;
        scene.render(progress, seconds);
        stage.current!.dataset.ready = 'true';
        schedule();
      } catch { /* The still image is a complete, usable fallback. */ }
      finally { loading = false; }
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { void start(); schedule(); } }, { rootMargin: '160px' });
    observer.observe(stage.current!);
    const motionChanged = () => {
      if (reduced.matches) { trigger?.kill(); trigger = undefined; cancelAnimationFrame(frame); frame = 0; scene?.dispose(); scene = undefined; stage.current!.dataset.ready = 'false'; }
      else void start();
    };
    const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; stage.current!.dataset.ready = 'false'; };
    const currentCanvas = canvas.current!;
    currentCanvas.addEventListener('webglcontextlost', contextLost);
    reduced.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', schedule);
    return () => { disposed = true; observer.disconnect(); resize.disconnect(); trigger?.kill(); cancelAnimationFrame(frame); scene?.dispose(); reduced.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', schedule); currentCanvas.removeEventListener('webglcontextlost', contextLost); };
  }, []);

  return <section ref={section} className="craft-section" id="interactive-3d-mill" aria-labelledby="craft-title">
    <div className="editorial-wrap craft-layout">
      <div className="craft-heading"><span className="eyebrow"><Wheat size={16} /> FROM GRAIN TO DOORSTEP</span><h2 id="craft-title">The good stuff<br /><em>takes its time.</em></h2><p>Follow the short journey behind every Babay Dee order: honest ingredients, patient milling, and a fresh handoff.</p><p className="craft-note">At Babay Dee, we keep milling temperatures low to safeguard natural nutrients and preserve healthy wheat germ.</p><span className="craft-scroll"><ArrowDown size={14} /> Scroll to follow the journey</span></div>
      <div ref={stage} className="craft-scene cinematic-mill"><img src="/milling/cinematic-still.webp" width="1200" height="900" alt="Electric motor and guarded belt driving a stone flour mill, with a steel hopper and fresh flour in a warmly lit workshop" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/milling/grinding.webp'; }} /><canvas ref={canvas} aria-hidden="true" /><div className="cinematic-vignette" aria-hidden="true" /><div className="scene-topline"><span>THE ART OF SLOW MILLING</span><span>EST. 1994</span></div><div className="scene-caption"><div><span>STONE. GRAIN. GOODNESS.</span><p>A tradition, quietly at work.</p></div><button type="button" className="scene-playback" aria-label={paused ? 'Play scene animation' : 'Pause scene animation'} aria-pressed={paused} onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); resume.current(); }}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div></div>
      <div className="craft-steps">{steps.map((step, i) => <article key={step.label}><span className="step-index">0{i + 1} <span>{step.label}</span></span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
    </div>
  </section>;
}
