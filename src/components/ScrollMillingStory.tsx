import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Clock3, PackageCheck, Truck, Wheat } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const steps = [
  {
    number: "01",
    eyebrow: "Source",
    title: "Grain with a story",
    body: "We start with carefully selected wheat and whole grains from trusted local harvests.",
    icon: Wheat,
    accent: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    number: "02",
    eyebrow: "Mill",
    title: "Slow stone pressure",
    body: "Traditional chakki milling keeps the process gentle, preserving the grain's natural character.",
    icon: Clock3,
    accent: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  {
    number: "03",
    eyebrow: "Deliver",
    title: "Fresh to your door",
    body: "Your order is packed with care and dispatched across Rawalpindi and Islamabad while it is at its best.",
    icon: Truck,
    accent: "text-blue-700 bg-blue-50 border-blue-200",
  },
];

export function ScrollMillingStory() {
  const sectionRef = useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();

      media.add(
        {
          desktop: "(min-width: 1024px)",
          mobile: "(max-width: 1023px)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { desktop, reduced } = (context.conditions || {}) as { desktop?: boolean; reduced?: boolean };
          const cards = gsap.utils.toArray<HTMLElement>(".milling-story-card", section);
          const line = section.querySelector<HTMLElement>(".milling-story-progress");

          if (reduced) {
            gsap.set(cards, { clearProps: "all" });
            if (line) gsap.set(line, { scaleX: 1 });
            return;
          }

          const rail = section.querySelector<HTMLElement>(".milling-story-rail");
          const trigger = desktop ? section : rail;
          if (!trigger) return;
          const timeline = gsap.timeline({
            scrollTrigger: {
              id: "milling-story-reveal",
              trigger,
              start: () => desktop
                ? "top top+=72px"
                : `top top+=${Math.ceil(document.querySelector("header")?.getBoundingClientRect().height || 64) + 16}px`,
              end: desktop ? "+=900" : "+=600",
              pin: true,
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          });

          timeline
            .fromTo(
              cards,
              { y: 44, opacity: 0 },
              { y: 0, opacity: 1, duration: 1, stagger: 0.8, ease: "power3.out" },
              0
            )
            .fromTo(
              line,
              { scaleX: 0, transformOrigin: "left center" },
              { scaleX: 1, duration: 2.4, ease: "none" },
              0.2
            );
        }
      );

      return () => media.revert();
    }, section);

    return () => context.revert();
  }, []);

  return (
    <section data-cinematic-section ref={sectionRef} className="cinematic-surface relative overflow-hidden bg-slate-950/75 text-white">
      <div className="mx-auto flex max-w-7xl flex-col justify-center px-3 py-10 sm:min-h-[560px] sm:px-8 sm:py-16 lg:min-h-[620px] lg:px-12">
        <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.85fr_1.5fr] lg:items-end lg:gap-20">
          <div className="max-w-md">
            <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
              <PackageCheck className="h-4 w-4" />
              From grain to doorstep
            </span>
            <h3 className="font-display text-2xl font-black leading-tight tracking-tight sm:text-4xl">
              The good stuff takes its time.
            </h3>
            <p className="mt-3 max-w-sm text-xs leading-6 sm:mt-5 sm:text-sm sm:leading-7 text-slate-300">
              Follow the short journey behind every Babay Dee order: honest ingredients, patient milling, and a fresh handoff.
            </p>
          </div>

          <div className="milling-story-rail relative min-w-0">
            <div className="absolute left-4 right-4 top-6 h-px bg-white/15 sm:left-5 sm:right-5 sm:top-7" aria-hidden="true" />
            <div className="milling-story-progress absolute left-4 top-6 h-px w-[calc(100%-2rem)] origin-left scale-x-0 bg-amber-300 sm:left-5 sm:top-7 sm:w-[calc(100%-2.5rem)]" aria-hidden="true" />
            <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-5">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.number} className="cinematic-surface milling-story-card relative min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 pt-3 pb-7 backdrop-blur-sm sm:min-h-[260px] sm:p-6">
                    <div className="relative z-10 mb-4 flex sm:mb-8 items-center justify-between">
                      <span className="cinematic-surface flex h-7 w-7 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-amber-300/60 bg-slate-950 text-[10px] sm:text-xs font-bold text-amber-200">
                        {step.number}
                      </span>
                      <Icon className="h-3.5 w-3.5 shrink-0 sm:h-5 sm:w-5 text-amber-200" />
                    </div>
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.12em] sm:tracking-[0.2em] text-slate-400">{step.eyebrow}</span>
                    <h4 className="mt-2 min-h-[3.375rem] sm:min-h-0 font-display text-[13px] leading-[1.125rem] sm:text-lg sm:leading-7 font-bold text-white">{step.title}</h4>
                    <p className="mt-2 text-[11px] leading-[1.6] sm:mt-3 sm:text-xs sm:leading-6 text-slate-300">{step.body}</p>
                    <span className={`absolute bottom-3 right-3 sm:bottom-5 sm:right-5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full border ${step.accent}`} aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ScrollMillingStory;
