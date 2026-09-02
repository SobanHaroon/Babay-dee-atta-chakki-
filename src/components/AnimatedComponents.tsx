import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { animate } from "animejs";

export function AnimatedNumber({ value, className }: { value: number, className?: string }) {
    return (
        <div className={cn("flex items-center", className)}>
            <div className="flex relative items-center">
                {value.toString().split("").map((digit, index) => (
                    <SingleNumberHolder key={index} value={digit} index={index} />
                ))}
            </div>
        </div>
    );
}

function SingleNumberHolder({ value, index }: { value: string, index: number, key?: React.Key }) {
    const [height, setHeight] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    let notANumber = false;

    useEffect(() => {
        if (containerRef.current) {
            setHeight(getComputedStyle(containerRef.current).height);
        }
    }, []);

    if (index === 0) {
        notANumber = isNaN(Number.parseInt(value));
    }

    const vars = {
        init: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    };

    return (
        <div
            className="relative"
            style={{ height: height || "auto", overflowY: "hidden", overflowX: "clip" }}
            ref={containerRef}
        >
            {notANumber && (
                <motion.span
                    initial="init"
                    animate="animate"
                    exit="exit"
                    variants={vars}
                    key={value}
                    layout="size"
                >
                    {value}
                </motion.span>
            )}
            {!notANumber && <RenderStrip value={value} eleHeight={height} />}
        </div>
    );
}

const zeroToNine = Array.from({ length: 10 }, (_, k) => k);

function RenderStrip({ eleHeight, value }: { eleHeight: string | null, value: string }) {
    const heightInNumber = Number.parseInt(eleHeight?.replace("px", "") || "48");
    const negative = heightInNumber * -1;
    const pos = heightInNumber;
    const prev = useRef(value);

    // Convert string values to numbers for comparison
    const currentVal = parseInt(value);
    const prevVal = parseInt(prev.current);

    // Calculate direction based on value change
    const diff = prevVal - currentVal;
    const dir = currentVal > prevVal ? pos * diff * -1 : negative * diff;

    // Update ref after calculation
    useEffect(() => {
        prev.current = value;
    }, [value]);

    return (
        <AnimatePresence mode='wait'>
            <motion.div
                key={value}
                initial={{ y: dir }}
                animate={{ y: 0 }}
                exit={{ y: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className='flex relative flex-col'
            >
                {/* Numbers smaller than current */}
                <motion.span
                    layout
                    key={`negative-${value}`}
                    className={cn('flex flex-col items-center absolute bottom-full left-0')}
                >
                    {zeroToNine.filter(val => val < currentVal).map((val, idx) => (
                        <span key={`${val}_${idx}`}>{val}</span>
                    ))}
                </motion.span>

                {/* Current Number */}
                <span key={`current-${value}`}>{value}</span>

                {/* Numbers larger than current */}
                <motion.span
                    layout
                    key={`positive-${value}`}
                    className={cn('flex flex-col items-center absolute top-full left-0')}
                >
                    {zeroToNine.filter(val => val > currentVal).map((val, idx) => (
                        <span key={`${val}_${idx}`}>{val}</span>
                    ))}
                </motion.span>
            </motion.div>
        </AnimatePresence>
    );
}

// Score-style animated number with color feedback
export function AnimatedScore({ value, duration = 0.2, className }: { value: number, duration?: number, className?: string }) {
    const prevValueRef = useRef(value);

    useEffect(() => {
        prevValueRef.current = value;
    }, [value]);

    const colors = {
        negative: "#10b981", // Warm green in modern UI
        positive: "#ef4444", // Modern red
        neutral: "currentColor"
    };

    const transforVal = 40;
    const forwards = {
        init: { y: transforVal * -1, opacity: 0, scale: 0.5, color: colors.negative },
        animate: {
            y: 0,
            opacity: 1,
            scale: [1.3, 1],
            color: [colors.negative, colors.negative, colors.neutral],
            transition: { duration: 0.4, times: [0, 0.7, 1], color: { times: [0, 0.75, 0.9] } },
        },
        exit: {
            y: transforVal,
            opacity: 0,
            scale: 0.5,
            color: colors.positive
        },
    };

    const backwards = {
        init: { y: transforVal, opacity: 0, scale: 0.5, color: colors.positive },
        animate: {
            y: 0,
            opacity: 1,
            scale: [1.3, 1],
            color: [colors.positive, colors.positive, colors.neutral],
            transition: { duration: 0.4, times: [0, 0.7, 1], color: { times: [0, 0.75, 0.9] } },
        },
        exit: {
            y: transforVal * -1,
            opacity: 0,
            scale: 0.5,
            color: colors.negative
        }
    };

    const variants = value >= prevValueRef.current ? forwards : backwards;
    const direction = value >= prevValueRef.current ? "forwards" : "backwards";

    return (
        <div className={cn("relative flex justify-center items-center", className)}>
            <motion.div layout="size" className='w-fit flex justify-center items-center'>
                {value.toString().split("").map((number, index) => (
                    <ScoreContainer
                        direction={direction}
                        duration={duration}
                        variants={variants}
                        number={number}
                        key={index}
                    />
                ))}
            </motion.div>
        </div>
    );
}

function ScoreContainer({ number, variants, duration = 0.7, direction }: {
    number: string,
    variants: any,
    duration?: number,
    direction: string,
    key?: React.Key
}) {
    const cached = React.useMemo(() => (
        <div className='relative'>
            <AnimatePresence mode='popLayout'>
                <motion.div
                    animate="animate"
                    className='flex justify-center items-center'
                    initial="init"
                    exit="exit"
                    variants={variants}
                    key={number.toString()}
                    layout="size"
                    transition={{ duration, ease: "backInOut" }}
                >
                    {number}
                </motion.div>
            </AnimatePresence>
        </div>
    ), [number, direction, variants, duration]);

    return <React.Fragment>{cached}</React.Fragment>;
}

interface FlipTextProps {
    className?: string;
    children: string;
    duration?: number;
    delay?: number;
    loop?: boolean;
    separator?: string;
    together?: boolean;
}

export function FlipText({
    className,
    children,
    duration = 2.2,
    delay = 0,
    loop = true,
    separator = " ",
    together = false,
}: FlipTextProps) {
    const words = React.useMemo(() => children.split(separator), [children, separator]);
    const totalChars = children.length;

    const getCharIndex = (wordIndex: number, charIndex: number) => {
        let index = 0;
        for (let i = 0; i < wordIndex; i++) {
            index += words[i].length + (separator === " " ? 1 : separator.length);
        }
        return index + charIndex;
    };

    return (
        <div
            className={cn(
                "flip-text-wrapper inline-block leading-none",
                className
            )}
            style={{ perspective: "1000px" }}
        >
            {words.map((word, wordIndex) => {
                const chars = word.split("");

                return (
                    <span
                        key={wordIndex}
                        className="word inline-block whitespace-nowrap"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        {chars.map((char, charIndex) => {
                            const currentGlobalIndex = getCharIndex(wordIndex, charIndex);

                            let calculatedDelay = delay;
                            if (!together) {
                                const normalizedIndex = currentGlobalIndex / totalChars;
                                const sineValue = Math.sin(normalizedIndex * (Math.PI / 2));
                                calculatedDelay = sineValue * (duration * 0.25) + delay;
                            }

                            return (
                                <span
                                    key={charIndex}
                                    className="flip-char inline-block relative text-shadow"
                                    data-char={char}
                                    style={
                                        {
                                            "--flip-duration": `${duration}s`,
                                            "--flip-delay": `${calculatedDelay}s`,
                                            "--flip-iteration": loop ? "infinite" : "1",
                                            transformStyle: "preserve-3d",
                                        } as React.CSSProperties
                                    }
                                >
                                    {char}
                                </span>
                            );
                        })}
                        {separator === " " && wordIndex < words.length - 1 && (
                            <span className="whitespace inline-block">&nbsp;</span>
                        )}
                        {separator !== " " && wordIndex < words.length - 1 && (
                            <span className="separator inline-block">{separator}</span>
                        )}
                    </span>
                );
            })}
        </div>
    );
}

export default FlipText;

// --- Premium Anime.js Components ---

export function AnimeCartItem({ children, className, id }: { children: React.ReactNode, className?: string, id: string, key?: React.Key }) {
    const elRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (elRef.current) {
            animate(elRef.current, {
                scale: [0.85, 1.05, 1],
                opacity: [0, 1],
                translateY: [15, 0],
                duration: 650,
                easing: 'easeOutElastic(1, 0.65)',
            });
        }
    }, [id]);

    return (
        <div ref={elRef} className={className} style={{ transformOrigin: "center center" }}>
            {children}
        </div>
    );
}

export function AnimeHover3D({ children, className }: { children: React.ReactNode, className?: string, key?: React.Key }) {
    const elRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!elRef.current) return;
        const clientX = e.clientX;
        const clientY = e.clientY;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
            if (!elRef.current) return;
            const rect = elRef.current.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            const rotateY = ((x - xc) / xc) * 3.5;
            const rotateX = ((yc - y) / yc) * 3.5;

            elRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
            elRef.current.style.transition = "transform 0.08s ease-out";
            elRef.current.style.willChange = "transform";
        });
    };

    const onMouseLeave = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (!elRef.current) return;
        elRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
        elRef.current.style.transition = "transform 0.25s ease-out";
        elRef.current.style.willChange = "auto";
    };

    return (
        <div
            ref={elRef}
            className={className}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ transformStyle: "preserve-3d", transformOrigin: "center center" }}
        >
            {children}
        </div>
    );
}

export function AnimeBouncyButton({ children, className, id, onClick, ...props }: any) {
    const elRef = useRef<HTMLButtonElement>(null);

    const onMouseEnter = () => {
        animate(elRef.current, {
            scale: 1.04,
            duration: 400,
            easing: 'easeOutElastic(1.2, 0.45)'
        });
    };

    const onMouseLeave = () => {
        animate(elRef.current, {
            scale: 1,
            duration: 300,
            easing: 'easeOutQuad'
        });
    };

    const onMouseDown = () => {
        animate(elRef.current, {
            scale: 0.95,
            duration: 100,
            easing: 'easeOutQuad'
        });
    };

    return (
        <button
            ref={elRef}
            className={className}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onClick={onClick}
            id={id}
            {...props}
        >
            {children}
        </button>
    );
}

export function AnimeScrollReveal({ children, className, delay = 0, direction = "up" }: { children: React.ReactNode, className?: string, delay?: number, direction?: "up" | "down" | "left" | "right", key?: React.Key }) {
    const translateAxis = direction === "up" || direction === "down" ? "y" : "x";
    const startValue = direction === "up" || direction === "left" ? 25 : -25;

    return (
        <motion.div
            initial={{ opacity: 0, [translateAxis]: startValue }}
            whileInView={{ opacity: 1, [translateAxis]: 0 }}
            viewport={{ once: true, margin: "-10px" }}
            transition={{
                duration: 0.6,
                delay: delay / 1000,
                ease: [0.16, 1, 0.3, 1]
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
