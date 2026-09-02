import React from "react";
import { motion } from "motion/react";
import { Sprout, Award, Truck, HeartHandshake, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { AnimeHover3D } from "./AnimatedComponents";

export function WhyChooseUs() {
  const benefits: any[] = [
    {
      title: "Fresh Products",
      desc: "Sourced daily from prime local harvests. Freshly stone-ground to order and packaged instantly, preserving peak freshness, natural enzymes, and rich flavor without artificial conditioning.",
      icon: Sprout,
      colorClass: "from-emerald-500/10 to-emerald-600/10 text-emerald-600 border-emerald-500/20",
      accentBg: "bg-emerald-500",
      iconVariants: {
        initial: { scale: 1, rotate: 0 },
        hover: {
          scale: [1, 1.25, 1.15],
          rotate: [0, -10, 10, -5, 5, 0],
          transition: { duration: 0.6, ease: "easeInOut" }
        }
      }
    },
    {
      title: "Quality Assured",
      desc: "Double-sieved pure flour streams under slow-milling traditional standards. Certified and guaranteed 100% free of chemical bleaching agents, chalk, fillers, or added preservatives.",
      icon: Award,
      colorClass: "from-amber-500/10 to-amber-600/10 text-amber-600 border-amber-500/20",
      accentBg: "bg-amber-500",
      iconVariants: {
        initial: { scale: 1, rotate: 0 },
        hover: {
          scale: [1, 1.2, 1.1],
          rotate: [0, 45, 90, 180, 360],
          transition: { duration: 0.8, ease: "easeInOut" }
        }
      }
    },
    {
      title: "Local Delivery",
      desc: "Freshness delivered directly to your doorstep. Dispatching daily across Rawalpindi (3-6 hours) & Islamabad (1-2 days) in hygienic, tamper-proof bags with live order tracking.",
      icon: Truck,
      colorClass: "from-blue-500/10 to-blue-600/10 text-blue-600 border-blue-500/20",
      accentBg: "bg-blue-500",
      iconVariants: {
        initial: { x: 0, y: 0 },
        hover: {
          x: [0, 12, -4, 4, 0],
          y: [0, -2, 2, -1, 0],
          transition: { duration: 0.75, ease: "easeInOut" }
        }
      }
    },
    {
      title: "Trusted Service",
      desc: "Over 30 years of traditional milling trust in Rawalpindi. Committed to wholesale grain honesty, transparent fair pricing, and friendly support that treats you like family.",
      icon: HeartHandshake,
      colorClass: "from-purple-500/10 to-purple-600/10 text-purple-600 border-purple-500/20",
      accentBg: "bg-purple-500",
      iconVariants: {
        initial: { scale: 1 },
        hover: {
          scale: [1, 1.2, 1.05, 1.2, 1],
          transition: { duration: 0.6, ease: "easeInOut" }
        }
      }
    }
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {/* Header and Subheader with Scroll Animation */}
      <motion.div 
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-xl mx-auto mb-12 space-y-2"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
            A Legacy of Absolute Purity
          </span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
          Why Families Trust Babay Dee Atta Chakki
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          We combine generational stone-ground milling expertise with absolute hygienic standards to deliver pure nourishment directly to your home.
        </p>
      </motion.div>

      {/* Grid of Benefits with Staggered Scroll Animation */}
      <motion.div 
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {benefits.map((benefit, idx) => {
          const IconComponent = benefit.icon;
          return (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1]
                  }
                }
              }}
              className="h-full"
            >
              <AnimeHover3D className="h-full">
                <motion.div
                  initial="initial"
                  whileHover="hover"
                  className="group relative p-6 bg-white rounded-2xl border border-slate-100 hover:border-slate-200/80 shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between text-center overflow-hidden h-full"
                >
                  {/* Top Decorative bar */}
                  <div className={cn("absolute top-0 left-0 right-0 h-1 transition-all duration-300 opacity-0 group-hover:opacity-100", benefit.accentBg)} />

                  {/* Icon Container with subtle background shape */}
                  <div className="flex justify-center mb-5">
                    <div className={cn(
                      "relative w-14 h-14 rounded-2xl bg-gradient-to-br border flex items-center justify-center shadow-2xs transition-all duration-300 group-hover:scale-105",
                      benefit.colorClass
                    )}>
                      {/* Subtle pulsing glow background */}
                      <span className="absolute inset-0 rounded-2xl bg-current opacity-0 group-hover:opacity-5 animate-ping duration-1000" />

                      {/* Animated Icon */}
                      <motion.div variants={benefit.iconVariants}>
                        <IconComponent className="w-6 h-6 stroke-[2]" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2.5 flex-1 flex flex-col">
                    <h4 className="font-sans font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors duration-200 uppercase tracking-wider">
                      {benefit.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed flex-1">
                      {benefit.desc}
                    </p>
                  </div>
                </motion.div>
              </AnimeHover3D>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

export default WhyChooseUs;

