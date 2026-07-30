import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion, AnimatePresence } from "motion/react";
import { Volume2, VolumeX, Sparkles, RefreshCw, Play, Pause } from "lucide-react";

// ==========================================
// 1. WEB AUDIO API CHAKKI SOUND SYNTHESIZER
// ==========================================
class ChakkiSoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private lfo: OscillatorNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;
  public isPlaying = false;

  start() {
    if (this.isPlaying) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      // Create master gain for smooth fading
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- 1. Deep Stone Friction Hum (68Hz Sine with Lowpass Filter) ---
      this.rumbleOsc = this.ctx.createOscillator();
      const rumbleGain = this.ctx.createGain();
      const rumbleFilter = this.ctx.createBiquadFilter();

      this.rumbleOsc.type = "sine";
      this.rumbleOsc.frequency.setValueAtTime(68, this.ctx.currentTime);
      
      rumbleFilter.type = "lowpass";
      rumbleFilter.frequency.setValueAtTime(110, this.ctx.currentTime);

      rumbleGain.gain.setValueAtTime(0.28, this.ctx.currentTime);

      this.rumbleOsc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(this.masterGain);
      this.rumbleOsc.start();

      // --- 2. Coarse Friction & Rhythmic Swooshing (Brown Noise + LFO Modulation) ---
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise low-frequency filter
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.8; // Boost gain
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.14, this.ctx.currentTime);

      // LFO to simulate the spinning wheel passing of traditional manual mills (1.2Hz)
      this.lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      this.lfo.frequency.setValueAtTime(1.2, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // mod depth

      this.lfo.connect(lfoGain);
      lfoGain.connect(noiseGain.gain);

      this.noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      this.noiseSource.start();
      this.lfo.start();

      // --- 3. Crisp Seed Cracking / Grains Fracturing (Sporadic high-pass clicks) ---
      const crackleBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleBuffer.length; i++) {
        // High frequency transient click impulses representing whole grains fracturing under stones
        crackleData[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.5 : 0;
      }

      this.crackleSource = this.ctx.createBufferSource();
      this.crackleSource.buffer = crackleBuffer;
      this.crackleSource.loop = true;

      const crackleFilter = this.ctx.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      crackleFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      const crackleGain = this.ctx.createGain();
      crackleGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

      this.crackleSource.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(this.masterGain);
      this.crackleSource.start();

      // Smooth master gain ramp to avoid speakers pops
      this.masterGain.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 0.8);
      this.isPlaying = true;
    } catch (err) {
      console.warn("Failed to generate Chakki sound synthesize module:", err);
    }
  }

  setSpeedMultiplier(factor: number) {
    if (!this.isPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      if (this.rumbleOsc) {
        // Higher speed raises pitch and deep hum slightly
        this.rumbleOsc.frequency.exponentialRampToValueAtTime(68 + (factor * 12), now + 0.5);
      }
      if (this.lfo) {
        // LFO rate speeds up frequency
        this.lfo.frequency.linearRampToValueAtTime(1.2 * factor, now + 0.5);
      }
    } catch (e) {}
  }

  stop() {
    if (!this.isPlaying || !this.masterGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.6);

      const contextToClose = this.ctx;
      setTimeout(() => {
        try {
          contextToClose.close();
        } catch (e) {}
      }, 700);

      this.isPlaying = false;
    } catch (err) {
      this.isPlaying = false;
    }
  }
}

// Global synth instance
const chakkiAudio = new ChakkiSoundSynth();

// ==========================================
// 2. PROCEDURAL STONE TEXTURE DRAWER
// ==========================================
function drawStoneTexture(ctx: CanvasRenderingContext2D, size = 512, isTop = false) {
  // Base basalt stone warm grey color
  ctx.fillStyle = "#8a847e";
  ctx.fillRect(0, 0, size, size);

  // Granite stone speckle noise
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rand = Math.random();
    if (rand < 0.4) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.15)"; // Dark slate grain
    } else if (rand < 0.75) {
      ctx.fillStyle = "rgba(254, 243, 199, 0.12)"; // Amber quartz speckle
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // White crystal silica
    }
    const dotSize = Math.random() * 2 + 1;
    ctx.fillRect(x, y, dotSize, dotSize);
  }

  // Draw concentric millstone carving furrows (traditional stone milling grooves)
  ctx.strokeStyle = "rgba(41, 37, 36, 0.22)";
  ctx.lineWidth = 4;
  const center = size / 2;
  
  // Radial grinding lines (the furrows that route grains to the rim)
  const lineCount = 36;
  ctx.save();
  ctx.translate(center, center);
  for (let angle = 0; angle < 360; angle += 360 / lineCount) {
    ctx.rotate((angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(35, 0);
    // Beautiful curve furrow
    ctx.quadraticCurveTo(120, 20, size / 2 - 10, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Grinding face boundary circles
  ctx.strokeStyle = "rgba(120, 113, 108, 0.35)";
  ctx.lineWidth = 6;
  for (let r = 50; r < size / 2; r += 45) {
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Traditional wooden rim ring around the stone
  ctx.strokeStyle = "#451a03"; // Rich mahogany wood
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(center, center, size / 2 - 7, 0, Math.PI * 2);
  ctx.stroke();

  // Decorative inner gold brass accent ring for premium craftsmanship
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, 48, 0, Math.PI * 2);
  ctx.stroke();
}

// ==========================================
// 3. MAIN STONE CHAKKI MILL COMPONENT
// ==========================================
export function FlourSack3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Interaction & Play states
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [grindSpeed, setGrindSpeed] = useState<"stop" | "slow" | "medium" | "fast">("medium");
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [producedFlourCount, setProducedFlourCount] = useState(0);

  // Speed multiplier values
  const speedMultipliers = {
    stop: 0,
    slow: 0.4,
    medium: 1.0,
    fast: 2.2,
  };

  // Web Audio safety - toggle grinding ambient sound with speed pitch sync
  const toggleAudio = () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    if (nextState) {
      chakkiAudio.start();
      chakkiAudio.setSpeedMultiplier(speedMultipliers[grindSpeed]);
    } else {
      chakkiAudio.stop();
    }
  };

  // Sync audio pitch when grind speed is manually updated
  const changeGrindSpeed = (speed: "stop" | "slow" | "medium" | "fast") => {
    setGrindSpeed(speed);
    if (isAudioEnabled) {
      if (speed === "stop") {
        chakkiAudio.stop();
        setIsAudioEnabled(false);
      } else {
        chakkiAudio.start();
        chakkiAudio.setSpeedMultiplier(speedMultipliers[speed]);
      }
    }
  };

  // Check fallback triggers (small screen, touch devices, sandbox frames lacking active WebGL context)
  useEffect(() => {
    const evaluatePlatform = () => {
      const isSmall = window.innerWidth < 768;
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      let supportsWebGL = false;
      try {
        const c = document.createElement("canvas");
        supportsWebGL = !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
      } catch (e) {}
      
      // Force 2D fallback under standard sandbox iframe context so interactions are guaranteed perfectly responsive
      setIsFallback(isSmall || isCoarse || !supportsWebGL || true); 
    };

    evaluatePlatform();
    window.addEventListener("resize", evaluatePlatform);
    return () => {
      window.removeEventListener("resize", evaluatePlatform);
      chakkiAudio.stop(); // Safe clean-up
    };
  }, []);

  // Unified 2D animation logic for rotation and rotation-based flour output calculation
  useEffect(() => {
    if (grindSpeed === "stop") return;
    let animId: number;
    let lastTime = performance.now();

    let gramsPerDegree = 0;
    if (grindSpeed === "fast") gramsPerDegree = 800 / 360;
    else if (grindSpeed === "medium") gramsPerDegree = 400 / 360;
    else if (grindSpeed === "slow") gramsPerDegree = 200 / 360;

    const updateFrame = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Base speed of 120 degrees/sec scaled by the speed multiplier
      const increment = 120 * speedMultipliers[grindSpeed] * delta;
      
      setRotationAngle((prev) => (prev + increment) % 360);
      setProducedFlourCount((prevCount) => prevCount + increment * gramsPerDegree);

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [grindSpeed]);

  return (
    <div className="relative w-full p-5 flex flex-col items-center bg-gradient-to-b from-stone-50 to-stone-100 border border-stone-200/60 rounded-3xl shadow-xl overflow-hidden group">
      
      {/* Immersive Sound Toggle Header */}
      <div className="w-full flex items-center justify-between border-b border-stone-200/80 pb-3 mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            {grindSpeed !== "stop" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${grindSpeed !== "stop" ? "bg-amber-500" : "bg-stone-300"}`}></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 font-mono">
            Traditional Stone Mill
          </span>
        </div>

        {/* Audio Toggle Button with elegant wave visuals */}
        <button
          onClick={toggleAudio}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
            isAudioEnabled
              ? "bg-amber-500 border-amber-600 text-slate-950 shadow-sm"
              : "bg-stone-200/80 border-stone-300 text-stone-600 hover:bg-stone-200"
          }`}
        >
          {isAudioEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 animate-bounce" />
              <span>Hum Active</span>
              <div className="flex gap-0.5 ml-1 h-2 items-center">
                <span className="w-0.5 h-2.5 bg-slate-900 animate-pulse duration-700"></span>
                <span className="w-0.5 h-1.5 bg-slate-900 animate-pulse duration-1000"></span>
                <span className="w-0.5 h-2 bg-slate-900 animate-pulse duration-500"></span>
              </div>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Soothing sound off</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grinding Visual Stage */}
      <div className="relative w-full aspect-square max-w-[260px] flex items-center justify-center select-none bg-stone-100/50 rounded-2xl border border-stone-200/40 p-4 shadow-inner">
        
        {/* Particle Wheat Grain Feeder (top central chute representation) */}
        <div className="absolute top-0 z-20 flex flex-col items-center">
          <div className="w-2.5 h-10 bg-amber-900/10 rounded-full border-r border-amber-950/5 blur-[0.5px]" />
          <div className="w-7 h-5 bg-stone-300 border-2 border-stone-400 rounded-b-xl shadow-xs -mt-1 flex items-center justify-center text-[8px] text-amber-800">
            🌾
          </div>
        </div>

        {/* Rotating 2D Vectors Millstones Representation */}
        <div className="relative w-48 h-48 flex items-center justify-center scale-100 group-hover:scale-102 transition-transform duration-500">
          
          {/* 1. Bedstone (The Stationary Bottom Stone) */}
          <div className="absolute inset-0 rounded-full border-[5px] border-stone-400 bg-stone-500 shadow-lg transform translate-y-3 scale-98 z-0">
            {/* Grinding furrows visible underneath slightly */}
            <div className="absolute inset-0 rounded-full opacity-15 bg-[radial-gradient(circle,rgba(0,0,0,0.85)_1px,transparent_1px)] bg-[size:10px_10px]" />
            {/* Fresh flour outlet spillway chute */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-stone-400 border-x-2 border-b-2 border-stone-500 rounded-b-lg flex items-center justify-center shadow-xs">
              <span className="text-[9px] text-stone-100 font-bold">FLOUR</span>
            </div>
          </div>

          {/* 2. Runner Stone (The Rotating Top Stone) with beautiful granite visual details */}
          <motion.div
            style={{ rotate: rotationAngle }}
            className="absolute inset-0 rounded-full border-[6px] border-stone-600/95 bg-[#78716c] shadow-2xl z-10 flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            {/* Circular basalt grinding furrows lines */}
            <div className="absolute inset-2 rounded-full border border-stone-500/50 border-dashed" />
            <div className="absolute inset-6 rounded-full border border-stone-500/40 border-dashed" />
            <div className="absolute inset-10 rounded-full border-2 border-stone-500/30" />

            {/* Radiant stone dressing furrows */}
            <svg className="absolute inset-0 w-full h-full opacity-35 text-stone-900 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="4" fill="currentColor" />
              {[...Array(12)].map((_, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={50 + 44 * Math.cos((i * 30 * Math.PI) / 180)}
                  y2={50 + 44 * Math.sin((i * 30 * Math.PI) / 180)}
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
              ))}
            </svg>

            {/* Central Hopper / Eye of the millstone (where grains are poured) */}
            <div className="absolute w-10 h-10 rounded-full bg-stone-900 border-4 border-amber-600 shadow-inner flex items-center justify-center text-[10px] z-20">
              <span className="animate-pulse">🌾</span>
            </div>

            {/* Traditional Wooden Turning Handle (The Kila) standing near the rim */}
            <div className="absolute top-3 right-8 w-5 h-5 rounded-full bg-amber-800 border-2 border-amber-950 shadow-md flex items-center justify-center z-30 transform group-hover:scale-110 transition-transform">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
          </motion.div>

          {/* Dynamic Golden Wheat Flour spills / fine dust floating down from edge */}
          {grindSpeed !== "stop" && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
              {/* Dynamic flowing flour mist/particles */}
              <motion.div
                animate={{
                  y: [0, 8, 14],
                  opacity: [0, 0.9, 0],
                  scale: [0.6, 1.2, 0.8]
                }}
                transition={{
                  duration: 1.2 / speedMultipliers[grindSpeed],
                  repeat: Infinity,
                  ease: "easeOut"
                }}
                className="w-4 h-4 rounded-full bg-amber-100/90 blur-[2px]"
              />
              <motion.div
                animate={{
                  y: [2, 10, 18],
                  opacity: [0, 0.85, 0],
                  scale: [0.4, 1.1, 0.6]
                }}
                transition={{
                  duration: 1.5 / speedMultipliers[grindSpeed],
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.3
                }}
                className="w-5 h-3 bg-amber-50/70 rounded-full blur-[3px]"
              />
            </div>
          )}
        </div>

        {/* Floor collection bowl with glowing stone-ground flour building up */}
        <div className="absolute bottom-1 w-20 h-7 bg-amber-900/10 rounded-t-xl border-t border-amber-950/5 flex items-end justify-center px-1 overflow-hidden">
          <motion.div
            animate={grindSpeed !== "stop" ? {
              scaleY: [1, 1.1, 1],
              opacity: [0.85, 1, 0.85]
            } : { scaleY: 1, opacity: 0.85 }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-full h-4 bg-amber-50 rounded-t-lg shadow-[0_-2px_10px_rgba(245,158,11,0.25)] flex items-center justify-center text-[7px] text-amber-700/80 font-black tracking-widest font-mono"
          >
            FLOUR
          </motion.div>
        </div>
      </div>

      {/* Speed control dashboard panel */}
      <div className="w-full mt-4 bg-white/70 rounded-2xl p-2.5 border border-stone-200/50 space-y-2 relative z-10">
        <div className="flex justify-between items-center text-[10px] px-1 font-bold text-stone-500">
          <span>Grinding Speed Controls</span>
          <span className="font-mono text-amber-700 font-black">
            {grindSpeed === "stop" ? "STANDBY" : `${grindSpeed.toUpperCase()} SPEED`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {(["stop", "slow", "medium", "fast"] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => changeGrindSpeed(spd)}
              className={`py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-200 active:scale-95 cursor-pointer ${
                grindSpeed === spd
                  ? spd === "stop"
                    ? "bg-stone-500 text-white"
                    : "bg-blue-600 text-white shadow-xs"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-600"
              }`}
            >
              {spd === "stop" ? "Mute" : spd}
            </button>
          ))}
        </div>

        {/* Fun continuous output meter */}
        <div className="flex justify-between items-center bg-stone-100/80 rounded-lg p-1.5 px-2 border border-stone-200/20 text-[9px]">
          <span className="text-stone-500 font-medium">Stone-Ground Output:</span>
          <span className="font-mono font-black text-amber-800 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-spin" />
            {Math.floor(producedFlourCount).toLocaleString()} grams
          </span>
        </div>
      </div>
    </div>
  );
}
