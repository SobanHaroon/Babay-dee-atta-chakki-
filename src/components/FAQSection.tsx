import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, ShieldCheck, Truck, Clock, Sparkles, HelpCircle, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface FAQItem {
  id: string;
  category: "purity" | "delivery" | "shelflife";
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: "purity-1",
    category: "purity",
    question: "Is your Atta (flour) 100% pure and unadulterated?",
    answer: "Absolutely! Unlike major commercial mills that extract the highly nutritious wheat bran (chokar) and wheat germ (sooji/maida) and add artificial chemical bleaching agents, we grind wheat in its 100% pure, natural, whole state. We do not extract anything or add any preservatives, chemicals, or synthetic supplements. You get wholesome, nutrient-rich flour just as nature intended."
  },
  {
    id: "purity-2",
    category: "purity",
    question: "What makes traditional stone-ground (Chakki) milling better than commercial milling?",
    answer: "Commercial roller mills operate at extremely high speeds, which generates intensive heat that destroys heat-sensitive vitamins (B-complex, E) and healthy fats in the wheat germ. Our traditional stone chakkis operate at a very slow, controlled speed. This keeps the temperature low, entirely preserving the natural vitamins, dietary fibers, and minerals. This low-temperature milling is why rotis made from our atta are naturally softer, richer in flavor, and easier to digest."
  },
  {
    id: "purity-3",
    category: "purity",
    question: "Are your other products like honey and dates also chemical-free?",
    answer: "Yes, every product we stock goes through rigorous selection. Our Iranian dates are premium-grade and imported directly without syrup treatment. Our wild forest honey is raw, cold-filtered to retain enzymes, and never blended with sugar syrup. We ensure all spices, lentils, and products have zero synthetic coloring or artificial additives."
  },
  {
    id: "delivery-1",
    category: "delivery",
    question: "Which areas in Rawalpindi and Islamabad do you deliver to?",
    answer: "We deliver to all major areas across Rawalpindi and Islamabad, including Gulrez Housing Scheme, Bahria Town (Phases 1-8), DHA, G-Sectors, F-Sectors, I-Sectors, Saddar, Chaklala Scheme 3, and surrounding areas. Our delivery charges are calculated transparently based on the distance from our milling facility at Gulrez Phase 3, Rawalpindi."
  },
  {
    id: "delivery-2",
    category: "delivery",
    question: "How long does delivery take after placing an order?",
    answer: "Orders are processed immediately and dispatched via our dedicated delivery riders. Generally, deliveries within Rawalpindi take 3 to 6 hours, while deliveries in Islamabad are fulfilled within 1 to 2 days. You can track your order status in real-time through our integrated 'Track Order' tab on this website, or get direct delivery updates via WhatsApp."
  },
  {
    id: "delivery-3",
    category: "delivery",
    question: "Do you offer emergency or immediate pick-up from the chakki?",
    answer: "Yes, you are always welcome to visit our physical chakki located on MAIN High Court Road, Gulrez Phase 3, Rawalpindi. You can place an order online and select 'Cash on Delivery' then message us to hold your items for on-site self-pickup, or simply walk in to experience the fresh, warm milling process yourself!"
  },
  {
    id: "shelflife-1",
    category: "shelflife",
    question: "What is the shelf life of your unrefined Atta and other products?",
    answer: "Since our flours are completely free from synthetic chemical preservatives and contain the natural wheat germ oils (which are usually removed in commercial flour to extend shelf life artificially), they have a natural shelf life of about 4 to 6 weeks. Other products like our honey, dates, and sifted lentils have much longer shelf lives (6 to 12 months) as they are dried or naturally stable."
  },
  {
    id: "shelflife-2",
    category: "shelflife",
    question: "How should I store pure, preservative-free flour to keep it fresh?",
    answer: "To maximize shelf life and protect pure flour from moisture and insects: store it in a cool, dry, well-ventilated place, preferably in a tightly sealed airtight container. Keep the container off the floor (on a shelf or stand) to prevent moisture absorption. During warm, humid monsoon months, we highly recommend purchasing smaller batches frequently or keeping a portion in the refrigerator."
  },
  {
    id: "shelflife-3",
    category: "shelflife",
    question: "Why does natural whole wheat flour occasionally attract insects sooner than commercial flour?",
    answer: "This is actually a scientific proof of absolute purity! Commercial flours are chemically bleached, heavily processed, and stripped of the germ (the life center of the grain). This leaves them biologically 'dead', so pests ignore them. Pure whole wheat contains active germ, vitamins, and nutritious fats which make it a high-value food source for all living organisms. Following our proper airtight storage guidelines completely prevents pest access."
  }
];

export function FAQSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "purity" | "delivery" | "shelflife">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFAQs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const categoriesConfig = [
    { id: "all", label: "All FAQs", icon: HelpCircle },
    { id: "purity", label: "Atta Purity", icon: ShieldCheck },
    { id: "delivery", label: "Delivery Zones", icon: Truck },
    { id: "shelflife", label: "Shelf Life & Storage", icon: Clock },
  ] as const;

  return (
    <div className="bg-slate-50/50 rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs space-y-8 mt-12">
      {/* FAQ Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
              Customer Knowledge Hub
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
            Get transparent, helpful answers about our traditional stone-ground millings, delivery locations across Twin Cities, and preservation guidelines.
          </p>
        </div>

        {/* Live Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions or terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-750 transition-colors placeholder:text-slate-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categoriesConfig.map((cat) => {
          const IconComponent = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setExpandedId(null); // collapse items on tab change
              }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer border",
                isActive
                  ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                  : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <IconComponent className={cn("w-4 h-4", isActive ? "text-amber-400" : "text-slate-450")} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* FAQs List */}
      <div className="space-y-3 min-h-[150px]">
        <AnimatePresence mode="popLayout">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((item, index) => {
              const isExpanded = expandedId === item.id;
              return (
                <motion.div
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "border rounded-2xl overflow-hidden bg-white transition-all duration-300 shadow-2xs",
                    isExpanded 
                      ? "border-amber-400/50 shadow-md ring-1 ring-amber-400/10" 
                      : "border-slate-100 hover:border-slate-200 hover:shadow-xs"
                  )}
                >
                  {/* Accordion Trigger */}
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="w-full px-5 py-4 text-left flex items-start justify-between gap-4 cursor-pointer focus:outline-hidden"
                  >
                    <div className="space-y-1">
                      <span className={cn(
                        "text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5",
                        item.category === "purity" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                        item.category === "delivery" && "bg-blue-50 text-blue-700 border border-blue-100",
                        item.category === "shelflife" && "bg-amber-50 text-amber-700 border border-amber-100"
                      )}>
                        {item.category === "purity" ? "Purity & Process" : item.category === "delivery" ? "Delivery Zones" : "Shelf Life & Storage"}
                      </span>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm leading-snug">
                        {item.question}
                      </h4>
                    </div>
                    <span className={cn(
                      "p-1.5 rounded-lg bg-slate-50 text-slate-400 transition-transform duration-300 shrink-0 mt-3",
                      isExpanded && "bg-amber-50 text-amber-600 rotate-180"
                    )}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  {/* Accordion Content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-slate-50 text-xs text-slate-600 leading-relaxed bg-slate-50/40">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 p-6"
            >
              <AlertCircle className="w-8 h-8 text-slate-350" />
              <div className="space-y-1">
                <p className="font-bold text-slate-700 text-xs">No matching questions found</p>
                <p className="text-[11px] text-slate-400">
                  Try adjusting your search query or selecting a different category tab.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-2 text-[10px] font-black tracking-wider uppercase bg-slate-900 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-all"
              >
                Reset Filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Helpful Hint banner */}
      <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <p className="font-bold text-amber-800 flex items-center gap-1.5">
            <span>💡</span> Have another question not answered here?
          </p>
          <p className="text-slate-600">
            Our flour masters at Gulrez Rawalpindi are available to assist you. Ask anything directly via Support Chat or WhatsApp.
          </p>
        </div>
        <button
          onClick={() => {
            const message = encodeURIComponent("Assalam-o-Alaikum Babay Dee! I have a question about your custom stone-ground flours & milling process.");
            window.open(`https://wa.me/923215010846?text=${message}`, "_blank");
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-sm shadow-amber-500/10"
        >
          Ask on WhatsApp
        </button>
      </div>
    </div>
  );
}
