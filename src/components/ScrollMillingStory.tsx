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

          if (desktop) {
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top top+=72px",
                end: "+=900",
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
          } else {
            cards.forEach((card) => {
              gsap.fromTo(
                card,
                { y: 28, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.7,
                  ease: "power3.out",
                  scrollTrigger: {
                    trigger: card,
                    start: "top 86%",
                    once: true,
                  },
                }
              );
            });
          }
        }
      );

      return () => media.revert();
    }, section);

    return () => context.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-slate-950/75 text-white">
      <div className="mx-auto flex min-h-[560px] max-w-7xl flex-col justify-center px-4 py-16 sm:px-8 lg:min-h-[620px] lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.5fr] lg:items-end lg:gap-20">
          <div className="max-w-md">
            <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
              <PackageCheck className="h-4 w-4" />
              From grain to doorstep
            </span>
            <h3 className="font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              The good stuff takes its time.
            </h3>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
              Follow the short journey behind every Babay Dee order: honest ingredients, patient milling, and a fresh handoff.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-5 right-5 top-7 hidden h-px bg-white/15 sm:block" aria-hidden="true" />
            <div className="milling-story-progress absolute left-5 top-7 hidden h-px w-[calc(100%-2.5rem)] origin-left scale-x-0 bg-amber-300 sm:block" aria-hidden="true" />
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.number} className="milling-story-card relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:min-h-[260px] sm:p-6">
                    <div className="relative z-10 mb-8 flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/60 bg-slate-950 text-xs font-bold text-amber-200">
                        {step.number}
                      </span>
                      <Icon className="h-5 w-5 text-amber-200" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{step.eyebrow}</span>
                    <h4 className="mt-2 font-display text-lg font-bold text-white">{step.title}</h4>
                    <p className="mt-3 text-xs leading-6 text-slate-300">{step.body}</p>
                    <span className={`absolute bottom-5 right-5 h-2 w-2 rounded-full border ${step.accent}`} aria-hidden="true" />
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
