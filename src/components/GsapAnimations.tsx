import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate } from "animejs";

// Register ScrollTrigger safely
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * GsapMagnetic Component
 * Creates a high-end magnetic pull effect on hover using GSAP physics
 */
export function GsapMagnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;

      gsap.to(el, {
        x: deltaX,
        y: deltaY,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.4)",
        overwrite: "auto",
      });
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className} style={{ display: "inline-block" }}>
      {children}
    </div>
  );
}

/**
 * GsapScrollReveal Component
 * Staggers children or section reveal with smooth GSAP ScrollTrigger
 */
export function GsapScrollReveal({
  children,
  className,
  stagger = 0.1,
  direction = "up",
  distance = 40,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let x = 0;
    let y = 0;
    if (direction === "up") y = distance;
    if (direction === "down") y = -distance;
    if (direction === "left") x = distance;
    if (direction === "right") x = -distance;

    const targets = container.children.length > 1 ? Array.from(container.children) : [container];

    gsap.fromTo(
      targets,
      {
        opacity: 0,
        x,
        y,
        scale: 0.96,
        filter: "blur(4px)",
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.85,
        stagger,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === container) {
          trigger.kill();
        }
      });
    };
  }, [direction, distance, stagger]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * Trigger Flour Particle Burst Effect
 * Creates dynamic particles flying from click position towards cart button
 */
export function triggerFlourParticleBurst(
  e: React.MouseEvent | MouseEvent | { clientX: number; clientY: number },
  targetCartId: string = "floating-cart-btn"
) {
  if (typeof window === "undefined") return;

  const startX = e.clientX;
  const startY = e.clientY;

  // Find target cart element for converging arc
  const cartEl =
    document.getElementById(targetCartId) ||
    document.getElementById("header-cart-btn") ||
    document.getElementById("header-basket-btn");
  let targetX = window.innerWidth - 60;
  let targetY = window.innerHeight - 60;

  if (cartEl) {
    const rect = cartEl.getBoundingClientRect();
    targetX = rect.left + rect.width / 2;
    targetY = rect.top + rect.height / 2;
  }

  // Animate target cart pulse with GSAP
  if (cartEl) {
    gsap.to(cartEl, {
      scale: 1.25,
      rotation: 8,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      delay: 0.45,
    });
  }

  const particleCount = 14;
  const container = document.body;

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.className =
      "fixed z-[9999] pointer-events-none rounded-full flex items-center justify-center font-bold text-[10px]";
    
    // Mix of wheat sparkles, flour dots, and golden stars
    const isGold = i % 2 === 0;
    const size = Math.floor(Math.random() * 8) + 8; // 8px to 16px
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    p.style.background = isGold
      ? "radial-gradient(circle, #f59e0b 0%, #d97706 100%)"
      : "radial-gradient(circle, #fef3c7 0%, #fde68a 100%)";
    p.style.boxShadow = isGold
      ? "0 0 10px rgba(245, 158, 11, 0.8)"
      : "0 0 8px rgba(254, 243, 199, 0.9)";
    p.style.border = "1px solid rgba(255,255,255,0.8)";

    container.appendChild(p);

    // Initial outward explosion vector
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5);
    const distance = Math.random() * 50 + 30;
    const burstX = startX + Math.cos(angle) * distance;
    const burstY = startY + Math.sin(angle) * distance;

    // Timeline: 1. Explode out -> 2. Fly in arc to cart -> 3. Fade out
    const tl = gsap.timeline({
      onComplete: () => {
        if (p.parentNode) p.parentNode.removeChild(p);
      },
    });

    tl.to(p, {
      x: burstX - startX,
      y: burstY - startY,
      scale: Math.random() * 0.8 + 0.8,
      duration: 0.2,
      ease: "power2.out",
    }).to(p, {
      x: targetX - startX,
      y: targetY - startY,
      scale: 0.2,
      opacity: 0.2,
      duration: 0.55,
      ease: "power3.in",
    });
  }
}

/**
 * GsapCounter Component
 * Animates numerical counter values smoothly using GSAP
 */
export function GsapCounter({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (node) {
          node.innerText = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
        }
      },
    });
  }, [value, duration, prefix, suffix]);

  return <span ref={nodeRef} className={className}>{prefix}0{suffix}</span>;
}

/**
 * GsapProgressBar
 * Top page scroll progress bar using GSAP
 */
export function GsapTopProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const updateProgress = () => {
      const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      const progress = scrollTotal > 0 ? (currentScroll / scrollTotal) * 100 : 0;

      gsap.to(bar, {
        width: `${progress}%`,
        duration: 0.1,
        ease: "none",
        overwrite: "auto",
      });
    };

    window.addEventListener("scroll", updateProgress);
    updateProgress();

    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[100] pointer-events-none bg-slate-200/20">
      <div
        ref={barRef}
        className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
        style={{ width: "0%" }}
      />
    </div>
  );
}
