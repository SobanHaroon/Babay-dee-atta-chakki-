import React, { useEffect, useRef } from "react";

interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  type: "wheat" | "rice" | "corn" | "millet";
  opacity: number;
}

export function FallingGrains() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainsRef = useRef<Grain[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Target 30 FPS cap for high performance without lag
    const FPS = 30;
    const frameInterval = 1000 / FPS;
    let lastFrameTime = 0;

    const startAnimationLoop = () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      lastFrameTime = performance.now();
      render(lastFrameTime);
    };

    const spawnGrainShower = (count = 25) => {
      // Limit total particles on screen to 35 max to avoid layout or GPU frame drops
      if (grainsRef.current.length > 35) return;

      const newGrains: Grain[] = [];
      const types: ("wheat" | "rice" | "corn" | "millet")[] = ["wheat", "rice", "corn", "millet"];

      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        let size = 5;
        if (type === "rice") size = Math.random() * 2 + 3.5;
        else if (type === "wheat") size = Math.random() * 3 + 4.5;
        else if (type === "corn") size = Math.random() * 3 + 4;
        else size = Math.random() * 2 + 2.5;

        newGrains.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * 150,
          vx: Math.random() * 1.5 - 0.75,
          vy: Math.random() * 2 + 3,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() * 0.04 - 0.02) * Math.PI,
          size,
          type,
          opacity: Math.random() * 0.3 + 0.6,
        });
      }

      grainsRef.current = [...grainsRef.current, ...newGrains];
      startAnimationLoop();
    };

    const spawnBurst = (x: number, y: number, count = 20) => {
      if (grainsRef.current.length > 35) return;

      const newGrains: Grain[] = [];
      const types: ("wheat" | "rice" | "corn" | "millet")[] = ["wheat", "rice", "corn", "millet"];

      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        let size = 4.5;
        if (type === "rice") size = Math.random() * 2 + 3.5;
        else if (type === "wheat") size = Math.random() * 2 + 4;
        else if (type === "corn") size = Math.random() * 2 + 3.5;
        else size = Math.random() * 1.5 + 2;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4.5 + 2.5;

        newGrains.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() * 0.08 - 0.04) * Math.PI,
          size,
          type,
          opacity: 1,
        });
      }

      grainsRef.current = [...grainsRef.current, ...newGrains];
      startAnimationLoop();
    };

    const handleGrainRain = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      if (detail.type === "modal-open") {
        spawnGrainShower(25);
      } else if (detail.type === "add-to-cart") {
        const startX = detail.x !== undefined ? detail.x : window.innerWidth / 2;
        const startY = detail.y !== undefined ? detail.y : window.innerHeight / 2;
        spawnBurst(startX, startY, 18);
      }
    };

    window.addEventListener("grain-rain", handleGrainRain);

    const render = (now: number) => {
      if (!isRunningRef.current) return;

      const elapsed = now - lastFrameTime;

      if (elapsed >= frameInterval) {
        lastFrameTime = now - (elapsed % frameInterval);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const grains = grainsRef.current;
        const aliveGrains: Grain[] = [];

        for (let i = 0; i < grains.length; i++) {
          const grain = grains[i];

          grain.x += grain.vx;
          grain.y += grain.vy;
          grain.vy += 0.07;
          grain.rotation += grain.rotationSpeed;

          if (grain.y > canvas.height * 0.8) {
            const distanceToBottom = canvas.height - grain.y;
            grain.opacity = Math.max(0, distanceToBottom / (canvas.height * 0.2));
          }

          ctx.save();
          ctx.translate(grain.x, grain.y);
          ctx.rotate(grain.rotation);
          ctx.globalAlpha = grain.opacity;

          if (grain.type === "wheat") {
            ctx.fillStyle = "#e5c158";
            ctx.beginPath();
            ctx.ellipse(0, 0, grain.size, grain.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (grain.type === "rice") {
            ctx.fillStyle = "#fcf9f2";
            ctx.beginPath();
            ctx.ellipse(0, 0, grain.size, grain.size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (grain.type === "corn") {
            ctx.fillStyle = "#ffd54f";
            ctx.beginPath();
            ctx.ellipse(0, 0, grain.size * 0.8, grain.size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = "#b07a51";
            ctx.beginPath();
            ctx.arc(0, 0, grain.size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();

          if (
            grain.y < canvas.height + 20 &&
            grain.opacity > 0.02 &&
            grain.x > -20 &&
            grain.x < canvas.width + 20
          ) {
            aliveGrains.push(grain);
          }
        }

        grainsRef.current = aliveGrains;

        if (aliveGrains.length === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          isRunningRef.current = false;
          if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
          }
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("grain-rain", handleGrainRain);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      isRunningRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[9999] select-none"
      style={{ mixBlendMode: "normal" }}
    />
  );
}

