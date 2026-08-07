/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, MouseEvent, FormEvent } from "react";
import {
  Wheat,
  ShoppingBag,
  Search,
  Heart,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Star,
  Check,
  Truck,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  User,
  Clock,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Info,
  Navigation,
  Loader2,
  TrendingUp,
  Zap
} from "lucide-react";
import { Product, Category, Review, CartItem, Order, DEFAULT_CATEGORIES } from "./types";
import { loadStoredReviews, saveStoredReviews, mergeStoredWithApiReviews } from "./data/reviewStorage";
import { DELIVERY_LOCATIONS, calculateDeliveryCharge, CHARGE_PER_KM } from "./deliveryData";
import { ProductCard } from "./components/ProductCard";
import { FallingGrains } from "./components/FallingGrains";
import { ProductDetailsModal } from "./components/ProductDetailsModal";
import { CartDrawer } from "./components/CartDrawer";
import { BundlesSection } from "./components/BundlesSection";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { OrderSuccessView } from "./components/OrderSuccessView";
import { SkeletonProductCard } from "./components/Skeleton";
import { SearchBar } from "./components/SearchBar";
import { SkeletonLoaderScreen } from "./components/SkeletonLoaderScreen";
import { FlipText, AnimatedNumber, AnimatedScore, AnimeScrollReveal } from "./components/AnimatedComponents";
import { GsapMagnetic, GsapScrollReveal, GsapTopProgressBar, GsapCounter } from "./components/GsapAnimations";
import { Logo } from "./components/Logo";
import { generateProductJsonLd, generateBreadcrumbJsonLd, injectJsonLdScript, removeJsonLdScript } from "./lib/jsonLd";
import { fetchProductsFromSupabaseDirectly } from "./lib/supabaseProducts";
import { insertOrderToSupabase, sendNtfyNotification } from "./lib/orderHelper";
import { supabase } from "./lib/supabaseClient";
import { motion, AnimatePresence } from "motion/react";
import { animate } from "animejs";
import { useToast } from "./components/ToastContainer";
import { triggerHapticFeedback } from "./lib/utils";

// Lazy-loaded heavy components for optimal mobile Lighthouse performance
const FlourSack3D = React.lazy(() => import("./components/FlourSack3D").then(m => ({ default: m.FlourSack3D })));
const WishlistDrawer = React.lazy(() => import("./components/WishlistDrawer").then(m => ({ default: m.WishlistDrawer })));
const ReviewsSection = React.lazy(() => import("./components/ReviewsSection").then(m => ({ default: m.ReviewsSection })));
const OrderTracker = React.lazy(() => import("./components/OrderTracker").then(m => ({ default: m.OrderTracker })));
const SupportChat = React.lazy(() => import("./components/SupportChat").then(m => ({ default: m.SupportChat })));
const FAQSection = React.lazy(() => import("./components/FAQSection").then(m => ({ default: m.FAQSection })));
const WhyChooseUs = React.lazy(() => import("./components/WhyChooseUs").then(m => ({ default: m.WhyChooseUs })));
const CheckoutMultiStepForm = React.lazy(() => import("./components/CheckoutMultiStepForm").then(m => ({ default: m.CheckoutMultiStepForm })));
const OrbitalImageWheel = React.lazy(() => import("./components/unlumen-ui/orbital-image-wheel").then(m => ({ default: m.OrbitalImageWheel })));
const PWAInstallPrompt = React.lazy(() => import("./components/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));

// @ts-ignore
import heroFlours from "./assets/images/slide_flours_1785374006306.jpg";
// @ts-ignore
import heroUtensils from "./assets/images/slide_utensils_1785374024278.jpg";
// @ts-ignore
import heroRice from "./assets/images/slide_rice_1785374044466.jpg";
// @ts-ignore
import heroSpices from "./assets/images/slide_spices_1785374065063.jpg";

// ========================================================
// STORE RECEIVING BANK ACCOUNT CONFIGURATION (EDIT ME)
// ========================================================
// Sourced from your request: These are left as empty string literals
// so you can open this file (src/App.tsx) and fill in your actual
// store bank details (e.g. Meezan Bank, Easypaisa, JazzCash, etc.)!
// If left empty, they will render clean placeholder slots.
export const STORE_BANK_NAME = "";       // e.g., "Meezan Bank"
export const STORE_ACCOUNT_TITLE = "";    // e.g., "Babay Dee Atta Chakki"
export const STORE_ACCOUNT_NUMBER = "";   // e.g., "1204817293847291"
export const STORE_IBAN = "";             // e.g., "PK41MEZN0012048172938472"

// Initialize Supabase Client is imported from ./lib/supabaseClient


// Seamless Native-App Page Transition Variants for Main Tab Switching
const pageTransitionVariants = {
  initial: { opacity: 0, y: 16, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
    }
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.995,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
    }
  }
};

export default function App() {
  const toast = useToast();
  // Store navigation states
  const [activeTab, setActiveTab] = useState<"home" | "shop" | "categories" | "about" | "contact" | "tracker">("home");

  // Hero slideshow background pictures state (4s cycle infinite loop)
  const heroImages = React.useMemo(() => [heroFlours, heroUtensils, heroRice, heroSpices], []);
  const [slideshowIndex, setSlideshowIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideshowIndex(prev => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [storedReviews, setStoredReviews] = useState<Review[]>(() => loadStoredReviews());

  // Dynamically generated upcoming 4 days for preferred delivery picker
  const upcomingDays = React.useMemo(() => {
    const days = [];
    const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
      const formattedDate = d.toLocaleDateString("en-US", { day: "numeric", month: "short" }); // e.g. "19 Jul"
      const value = d.toISOString().split("T")[0]; // YYYY-MM-DD
      days.push({ label, formattedDate, value });
    }
    return days;
  }, []);

  const deliverySlots = React.useMemo(() => [
    { id: "slot1", name: "Morning", time: "09:00 AM - 12:00 PM", icon: "🌅" },
    { id: "slot2", name: "Afternoon", time: "12:00 PM - 03:00 PM", icon: "☀️" },
    { id: "slot3", name: "Late Afternoon", time: "03:00 PM - 06:00 PM", icon: "🌤️" },
    { id: "slot4", name: "Evening", time: "06:00 PM - 09:00 PM", icon: "🌆" }
  ], []);

  // Memoized item list strictly for "Popular In Your Area" section
  const popularAreaOrbitalItems = React.useMemo(() => {
    const specs = [
      { name: "Chakki Atta", kw: ["chakki"], price: 170, unit: "Kg", desc: "100% Pure Slow Stone-Ground Whole Wheat Flour", img: heroFlours, badge: "BESTSELLER" },
      { name: "Multi Grain Atta", kw: ["multi", "diet"], price: 240, unit: "Kg", desc: "Nutritious multi-grain blend flour rich in fiber & minerals", img: heroFlours, badge: "DIET CHOICE" },
      { name: "Daal Mash", kw: ["mash"], price: 340, unit: "Kg", desc: "Triple sieved premium clean Daal Mash", img: heroSpices, badge: "HIGH DEMAND" },
      { name: "Daal Masar", kw: ["masar", "masoor"], price: 290, unit: "Kg", desc: "Pure unpolished whole red lentils", img: heroSpices, badge: "POPULAR" },
      { name: "Daal Chana", kw: ["chana"], price: 260, unit: "Kg", desc: "Protein-rich unadulterated split chickpea pulse", img: heroSpices, badge: "TOP RATED" },
      { name: "Jo Atta", kw: ["jo"], price: 210, unit: "Kg", desc: "Pure stone-ground barley flour for heart & wellness", img: heroFlours, badge: "ORGANIC" },
      { name: "Bajra", kw: ["bajra"], price: 195, unit: "Kg", desc: "Traditional pearl millet grain & flour rich in iron", img: heroFlours, badge: "TRADITIONAL" },
    ];

    return specs.map((spec, idx) => {
      const matched = products.find((p) => {
        const lower = p.name.toLowerCase();
        return spec.kw.some((k) => lower.includes(k));
      });

      if (matched) {
        return {
          id: `pop_${matched.id}_${idx}`,
          src: matched.productImage || spec.img,
          alt: spec.name,
          label: spec.name,
          subtitle: matched.desc || spec.desc,
          price: matched.price || spec.price,
          badge: spec.badge,
          category: matched.category || "flour",
          productObj: matched,
        };
      }

      const syntheticProd: Product = {
        id: `pop_${spec.name.toLowerCase().replace(/\s+/g, "_")}_${idx}`,
        name: spec.name,
        price: spec.price,
        unit: spec.unit,
        desc: spec.desc,
        img: "chakki_atta.png",
        productImage: spec.img,
        category: spec.name.toLowerCase().includes("daal") ? "lentils" : "flour",
        specs: { "Milling Style": "Stone Ground", Sourcing: "Rawalpindi & Islamabad Local" },
        outOfStock: false,
      };

      return {
        id: syntheticProd.id,
        src: spec.img,
        alt: spec.name,
        label: spec.name,
        subtitle: spec.desc,
        price: spec.price,
        badge: spec.badge,
        category: syntheticProd.category,
        productObj: syntheticProd,
      };
    });
  }, [products, heroFlours, heroRice, heroSpices, heroUtensils]);

  // Memoized item list strictly for "Freshly Sourced Products" section
  const freshSourcedOrbitalItems = React.useMemo(() => {
    const specs = [
      { name: "Chakki Atta", kw: ["chakki"], price: 170, unit: "Kg", desc: "100% Pure Slow Stone-Ground Whole Wheat Flour", img: heroFlours, badge: "FRESH MILLED" },
      { name: "Besan", kw: ["besan"], price: 250, unit: "Kg", desc: "Pure double-sieved stone ground gram flour", img: heroFlours, badge: "BESTSELLER" },
      { name: "Rice Atta", kw: ["rice", "chawal"], price: 200, unit: "Kg", desc: "Super fine stone-milled Basmati rice flour", img: heroRice, badge: "SUPER FINE" },
      { name: "Jo Atta", kw: ["jo"], price: 210, unit: "Kg", desc: "Pure organic stone-milled barley flour", img: heroFlours, badge: "WELLNESS" },
      { name: "Bajra Atta", kw: ["bajra"], price: 195, unit: "Kg", desc: "Traditional stone ground pearl millet flour", img: heroFlours, badge: "PURE GRAIN" },
      { name: "Multi Grain Atta", kw: ["multi", "diet"], price: 240, unit: "Kg", desc: "7-Grain wholesome high fiber flour mix", img: heroFlours, badge: "7-GRAIN" },
      { name: "Jo Ka Daliya", kw: ["jo", "daliya"], price: 220, unit: "Kg", desc: "Coarsely crushed organic barley porridge", img: heroUtensils, badge: "HEALTH DALIYA" },
      { name: "Gandum Ka Daliya", kw: ["gandum", "daliya"], price: 180, unit: "Kg", desc: "Pure crushed whole wheat grain porridge", img: heroUtensils, badge: "WHOLE GRAIN" },
    ];

    return specs.map((spec, idx) => {
      const matched = products.find((p) => {
        const lower = p.name.toLowerCase();
        return spec.kw.some((k) => lower.includes(k));
      });

      if (matched) {
        return {
          id: `fresh_${matched.id}_${idx}`,
          src: matched.productImage || spec.img,
          alt: spec.name,
          label: spec.name,
          subtitle: matched.desc || spec.desc,
          price: matched.price || spec.price,
          badge: spec.badge,
          category: matched.category || "flour",
          productObj: matched,
        };
      }

      const syntheticProd: Product = {
        id: `fresh_${spec.name.toLowerCase().replace(/\s+/g, "_")}_${idx}`,
        name: spec.name,
        price: spec.price,
        unit: spec.unit,
        desc: spec.desc,
        img: "chakki_atta.png",
        productImage: spec.img,
        category: "flour",
        specs: { "Milling Style": "Fresh Stone Ground", Purity: "Zero Preservatives" },
        outOfStock: false,
      };

      return {
        id: syntheticProd.id,
        src: spec.img,
        alt: spec.name,
        label: spec.name,
        subtitle: spec.desc,
        price: spec.price,
        badge: spec.badge,
        category: syntheticProd.category,
        productObj: syntheticProd,
      };
    });
  }, [products, heroFlours, heroRice, heroSpices, heroUtensils]);
  
  // Loading indicators
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOption, setSortOption] = useState("default");
  const [trendingFilter, setTrendingFilter] = useState<"all" | "bestseller" | "new" | "viewed" | "ordered">("all");

  // Wishlist state with localStorage
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("babay_dee_wishlist");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  // Ensure light mode is permanent
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("babay_dee_wishlist", JSON.stringify(wishlistIds));
    } catch (e) {
      console.error("Wishlist save error:", e);
    }
  }, [wishlistIds]);

  const handleToggleWishlist = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        toast.info("Removed from saved wishlist");
        return prev.filter((id) => id !== productId);
      } else {
        toast.wheat("Saved to your wishlist! ❤️");
        return [...prev, productId];
      }
    });
  };

  const [lastRemovedItem, setLastRemovedItem] = useState<CartItem | null>(null);

  // Shopping cart details with localStorage persistence
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("babay_dee_cart");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cart items from localStorage:", e);
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [pulseBasket, setPulseBasket] = useState(false);
  const [selectedArea, setSelectedArea] = useState("Islamabad"); // default delivery town, Rawalpindi alternative
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>("Sector I-8 / I-9");
  const [customDistanceKm, setCustomDistanceKm] = useState<number>(12);
  
  // Modals / Overlays
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Checkout stage
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [checkoutFormData, setCheckoutFormData] = useState({
    name: "",
    phone: "",
    address: "",
    area: "Islamabad",
    neighborhood: "",
    paymentMethod: "Cash on Delivery",
    sendingBank: "Easypaisa (Telenor Bank)",
    transactionId: "",
    deliveryDate: new Date().toISOString().split("T")[0],
    deliverySlot: "Express Same-Day"
  });
  const [checkoutError, setCheckoutError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    toast.info("Detecting your location via GPS...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // Babay Dee Chakki store coordinates in Rawalpindi (High Court Rd, Gulrez)
        const storeLat = 33.5651;
        const storeLon = 73.0957;

        // Haversine formula for distance in km
        const R = 6371;
        const dLat = (lat - storeLat) * (Math.PI / 180);
        const dLon = (lon - storeLon) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(storeLat * (Math.PI / 180)) *
            Math.cos(lat * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = Math.round(R * c * 10) / 10;

        // Determine city based on latitude in twin cities area
        let detectedCity = "Rawalpindi";
        if (lat > 33.665) {
          detectedCity = "Islamabad";
        }

        // Attempt reverse geocode via OpenStreetMap Nominatim
        let detectedStreet = "";
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              const resCity = addr.city || addr.town || addr.county || addr.state_district || "";
              if (resCity.toLowerCase().includes("islamabad")) {
                detectedCity = "Islamabad";
              } else if (resCity.toLowerCase().includes("rawalpindi")) {
                detectedCity = "Rawalpindi";
              }

              const parts = [
                addr.road || addr.street,
                addr.suburb || addr.neighbourhood || addr.residential || addr.quarter,
                addr.city_district || addr.subdistrict
              ].filter(Boolean);

              if (parts.length > 0) {
                detectedStreet = parts.join(", ");
              }
            }
          }
        } catch (e) {
          console.warn("Reverse geocoding network call skipped:", e);
        }

        // Update delivery area city state
        setSelectedArea(detectedCity);
        setCheckoutFormData((prev) => {
          let newAddress = prev.address;
          if (detectedStreet && (!prev.address || prev.address.trim() === "")) {
            newAddress = `${detectedStreet}, ${detectedCity}`;
          }
          return {
            ...prev,
            area: detectedCity,
            address: newAddress,
          };
        });

        // Find closest sublocation in delivery data
        const cityLocations = DELIVERY_LOCATIONS.filter((l) => l.city === detectedCity);
        let closestLoc = cityLocations[0];
        let minDiff = 999;
        cityLocations.forEach((loc) => {
          const diff = Math.abs(loc.distanceKm - distKm);
          if (diff < minDiff) {
            minDiff = diff;
            closestLoc = loc;
          }
        });

        if (closestLoc && minDiff < 4) {
          setSelectedSubLocation(closestLoc.name);
        } else {
          setSelectedSubLocation("Custom");
          setCustomDistanceKm(Math.max(1, Math.min(45, distKm)));
        }

        setIsDetectingLocation(false);
        toast.success(
          `📍 Location Detected: ${detectedCity} (~${distKm} km from store). Delivery area updated!`
        );
      },
      (error) => {
        setIsDetectingLocation(false);
        console.warn("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Please select your city manually.");
        } else {
          toast.error("Could not fetch GPS coordinates. Please select your city manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Desktop active custom Cursor state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorHovering, setCursorHovering] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  // Scroll visibility
  const [isSticky, setIsSticky] = useState(false);

  // Fetch initial e-commerce data from APIs
  useEffect(() => {
    // Delete any cached product/category details from the local storage immediately on startup
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem("products");
        localStorage.removeItem("cached_products");
        localStorage.removeItem("all_products");
        localStorage.removeItem("categories");
        console.log("🧹 Local storage product details and cached lists successfully deleted!");
      } catch (e) {
        console.error("Local storage clean error:", e);
      }
    }

    const fetchData = async () => {
      setIsLoading(true);
      const fetchSafe = async (url: string) => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          console.warn(`Resilient recovery: fetch failed for ${url}`, e);
        }
        return null;
      };

      try {
        const [cats, prods, feat, pop, revs] = await Promise.all([
          fetchSafe("/api/categories"),
          fetchSafe("/api/products"),
          fetchSafe("/api/featured-products"),
          fetchSafe("/api/popular-products"),
          fetchSafe("/api/reviews")
        ]);

        if (cats && Array.isArray(cats) && cats.length > 0) setCategories(cats);
        else setCategories(DEFAULT_CATEGORIES);

        const apiReviews = revs && Array.isArray(revs) ? revs : [];
        const mergedReviews = mergeStoredWithApiReviews(apiReviews, storedReviews);
        setReviews(mergedReviews);
        setStoredReviews(mergedReviews);

        // If backend API succeeded and returned products
        if (prods && Array.isArray(prods) && prods.length > 0) {
          setProducts(prods);
          if (feat && Array.isArray(feat)) setFeaturedProducts(feat);
          if (pop && Array.isArray(pop)) setPopularProducts(pop);
        } else {
          // Fallback: Query Supabase directly from client (crucial for Vercel static deployments)
          console.log("⚡ Express API unavailable or empty. Fetching products directly from Supabase...");
          const directProds = await fetchProductsFromSupabaseDirectly();
          if (directProds && directProds.length > 0) {
            setProducts(directProds);
            setFeaturedProducts(directProds.filter(p => p.featured));
            setPopularProducts(directProds.filter(p => p.popular));
          }
        }
      } catch (err) {
        console.error("API Fetch operational failure - attempting direct Supabase query.", err);
        const directProds = await fetchProductsFromSupabaseDirectly();
        if (directProds && directProds.length > 0) {
          setProducts(directProds);
          setFeaturedProducts(directProds.filter(p => p.featured));
          setPopularProducts(directProds.filter(p => p.popular));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Turn real-time synchronization on for products (polling every 5 seconds)
    const pollInterval = setInterval(async () => {
      const fetchSafe = async (url: string) => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          // Silent recovery in background
        }
        return null;
      };

      try {
        const [freshProds, freshFeat, freshPop] = await Promise.all([
          fetchSafe("/api/products"),
          fetchSafe("/api/featured-products"),
          fetchSafe("/api/popular-products")
        ]);

        if (freshProds && Array.isArray(freshProds) && freshProds.length > 0) {
          setProducts(freshProds);
          if (freshFeat) setFeaturedProducts(freshFeat);
          if (freshPop) setPopularProducts(freshPop);
        } else {
          const directProds = await fetchProductsFromSupabaseDirectly();
          if (directProds && directProds.length > 0) {
            setProducts(directProds);
            setFeaturedProducts(directProds.filter(p => p.featured));
            setPopularProducts(directProds.filter(p => p.popular));
          }
        }
      } catch (err) {
        // Silent recovery
      }
    }, 5000);

    // Turn on real-time synchronization using Supabase Realtime Channels
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel("realtime-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          async (payload) => {
            console.log("⚡ Real-time Product change detected via Supabase Realtime:", payload);
            try {
              const directProds = await fetchProductsFromSupabaseDirectly();
              if (directProds && directProds.length > 0) {
                setProducts(directProds);
                setFeaturedProducts(directProds.filter(p => p.featured));
                setPopularProducts(directProds.filter(p => p.popular));
              }
            } catch (err) {
              console.error("Realtime fetch products failed:", err);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            console.log("⚡ Real-time Order change detected via Supabase Realtime:", payload);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("order-realtime-update", { detail: payload }));
            }
          }
        )
        .subscribe((status) => {
          console.log("Supabase Realtime subscription status:", status);
        });
    }

    // Check desktop screen factor
    const checkViewport = () => {
      setIsDesktop(window.innerWidth > 768 && navigator.maxTouchPoints === 0);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);

    // Track scroll with throttling for performance
    let lastScroll = 0;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScroll > 50) { // ~20fps for scroll detection
        setIsSticky(window.scrollY > 40);
        lastScroll = now;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Ensure focused elements stay visible above the soft keyboard on mobile/tablet screens
    const handleInputFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        // First scroll
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
        // Second scroll (backup to capture complete keyboard sliding on slower devices)
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 450);
      }
    };

    const handleViewportChange = () => {
      const activeEl = document.activeElement as HTMLElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT")
      ) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    };

    document.addEventListener("focus", handleInputFocus, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
    }

    return () => {
      window.removeEventListener("resize", checkViewport);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("focus", handleInputFocus, true);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange);
      }
      clearInterval(pollInterval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Tracking cursor movement with throttling for performance
  useEffect(() => {
    if (!isDesktop) return;

    let lastMouseMove = 0;
    const throttleDelay = 16; // ~60fps

    const handleMouseMove = (e: any) => {
      const now = Date.now();
      if (now - lastMouseMove > throttleDelay) {
        setMousePos({ x: e.clientX, y: e.clientY });
        lastMouseMove = now;

        // Determine if cursor is currently hovering interactive nodes
        const target = e.target as HTMLElement;
        const isInteractive =
          target.closest("button") ||
          target.closest("a") ||
          target.closest("input") ||
          target.closest("select") ||
          target.closest("textarea") ||
          target.closest(".cursor-pointer") ||
          target.getAttribute("role") === "button";

        setCursorHovering(!!isInteractive);
      }
    };

    // Ripple click handler
    const handleMouseClick = (e: any) => {
      setRipples((prev) => [...prev, { x: e.clientX, y: e.clientY, id: Date.now() }]);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleMouseClick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleMouseClick);
    };
  }, [isDesktop]);

  // Save cart state to localStorage on changes with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("babay_dee_cart", JSON.stringify(cartItems));
      } catch (e) {
        console.error("Failed to save cart state to localStorage:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cartItems]);

  // Scroll to top smoothly when tab, checkout status, or order status changes
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [activeTab, checkoutActive, createdOrder]);

  // Clean decayed ripples after 1s
  useEffect(() => {
    if (ripples.length === 0) return;
    const interval = setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 1100);
    return () => clearTimeout(interval);
  }, [ripples]);

  // Synchronize dynamic URL query parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Parse tab parameter
    const tabParam = params.get("tab");
    if (tabParam && ["home", "shop", "categories", "about", "contact", "tracker"].includes(tabParam)) {
      setActiveTab(tabParam as any);
      setSelectedProduct(null);
    }

    // Parse product parameter for detail view modal
    const productParam = params.get("product");
    if (productParam && products.length > 0) {
      const match = products.find((p) => p.id === productParam);
      if (match) {
        setSelectedProduct(match);
      }
    }
  }, [products]);

  // Sync page state back to URL query parameters for live shareable link generation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (selectedProduct) {
      params.set("product", selectedProduct.id);
      params.delete("tab");
    } else {
      params.delete("product");
      if (activeTab && activeTab !== "home") {
        params.set("tab", activeTab);
      } else {
        params.delete("tab");
      }
    }
    
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeTab, selectedProduct]);

  // Dynamically change the document title based on the active Tab or Selected Product
  useEffect(() => {
    if (selectedProduct) {
      document.title = `Babay Dee | ${selectedProduct.name} - Premium Quality`;
      return;
    }

    switch (activeTab) {
      case "shop":
        document.title = "Babay Dee Atta Chakki | Shop Fresh Flour & Organic Grocery";
        break;
      case "categories":
        document.title = "Babay Dee Atta Chakki | Browse Categories & Grain Selections";
        break;
      case "about":
        document.title = "Babay Dee Atta Chakki | Our Traditional Chakki & Heritage";
        break;
      case "contact":
        document.title = "Babay Dee Atta Chakki | Get in Touch & Delivery Status";
        break;
      case "tracker":
        document.title = "Babay Dee Atta Chakki | Live Order Milling & Delivery Tracker";
        break;
      case "home":
      default:
        document.title = "Babay Dee Atta Chakki | Freshly Milled Whole Wheat Atta & Pure Grains";
        break;
    }
  }, [activeTab, selectedProduct]);

  // Dynamically generate and inject JSON-LD structured data for selected products and breadcrumbs
  useEffect(() => {
    if (selectedProduct) {
      // Dynamic Product Schema
      const productSchema = generateProductJsonLd(selectedProduct);
      injectJsonLdScript(productSchema, "dynamic-product-jsonld");

      // Dynamic Breadcrumbs Schema
      const breadcrumbsSchema = generateBreadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Shop", url: "/?tab=shop" },
        { name: selectedProduct.name, url: `/?product=${selectedProduct.id}` }
      ]);
      injectJsonLdScript(breadcrumbsSchema, "dynamic-breadcrumb-jsonld");
    } else {
      removeJsonLdScript("dynamic-product-jsonld");
      removeJsonLdScript("dynamic-breadcrumb-jsonld");
    }
  }, [selectedProduct]);

  // Sync Cart quantity edits
  const handleAddToCart = (p: Product, quantity: number = 1, e?: React.MouseEvent | MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    triggerHapticFeedback(35);

    // Trigger falling grains burst at click coordinate
    const x = e && typeof (e as any).clientX === "number" ? (e as any).clientX : window.innerWidth / 2;
    const y = e && typeof (e as any).clientY === "number" ? (e as any).clientY : window.innerHeight / 2;
    window.dispatchEvent(new CustomEvent("grain-rain", { detail: { type: "add-to-cart", x, y } }));

    setCartItems((prevItems) => {
      const exists = prevItems.find((item) => item.id === p.id);
      if (exists) {
        return prevItems.map((item) =>
          item.id === p.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prevItems,
        {
          id: p.id,
          name: p.name,
          price: p.price,
          unit: p.unit,
          img: p.img,
          productImage: p.productImage,
          quantity
        }
      ];
    });

    toast.wheat(`Added ${quantity} × ${p.name} to basket!`);

    // Animate product adding interaction feedback physical react
    setIsCartOpen(true);
    setPulseBasket(true);
    setTimeout(() => {
      setPulseBasket(false);
    }, 800);
  };

  const handleUpdateCartQty = (id: string, quantity: number) => {
    setCartItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item && item.quantity !== quantity) {
        toast.info(`Updated quantity of ${item.name} to ${quantity}`);
      }
      return prev.map((item) => (item.id === id ? { ...item, quantity } : item));
    });
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item) {
        setLastRemovedItem(item);
        toast.warning(`Removed ${item.name} from basket`);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUndoRemoveItem = () => {
    if (lastRemovedItem) {
      setCartItems((prev) => {
        if (prev.some((it) => it.id === lastRemovedItem.id)) return prev;
        return [...prev, lastRemovedItem];
      });
      toast.wheat(`Restored ${lastRemovedItem.name} to basket!`);
      setLastRemovedItem(null);
    }
  };

  // Submit complete order at checkout
  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCheckoutError("");

    const { name, phone, address, area, neighborhood } = checkoutFormData;
    if (!name.trim() || !phone.trim() || !address.trim() || !neighborhood.trim()) {
      const errMsg = "Please fill in all customer inputs (Name, Phone, Area/Neighborhood, and Full Address).";
      setCheckoutError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      const errMsg = "Your basket is empty. Please add items before placing an order.";
      setCheckoutError(errMsg);
      toast.error(errMsg);
      return;
    }

    // Show pre-checkout summary confirmation modal
    setShowPreCheckoutModal(true);
  };

  // Final confirmation checkout handler
  const handleFinalOrderSubmit = async () => {
    triggerHapticFeedback([40, 60, 50]);
    setIsPlacingOrder(true);
    setCheckoutError("");

    const { name, phone, address, area, neighborhood } = checkoutFormData;
    const cleanArea = (area || "Rawalpindi").toLowerCase().trim();
    const isIslamabad = cleanArea.includes("islamabad") || cleanArea === "isb" || cleanArea.includes("islo");
    const validatedArea = isIslamabad ? "Islamabad" : (area || "Rawalpindi");
    const finalPaymentMethod = "Cash on Delivery";
    const cleanNeighborhood = neighborhood?.trim() || "";
    const fullAddress = [address.trim(), cleanNeighborhood, validatedArea].filter(Boolean).join(", ");

    const subLocObj = DELIVERY_LOCATIONS.find(l => l.city === validatedArea && l.name === selectedSubLocation);
    const dist = selectedSubLocation === "Custom" ? customDistanceKm : (subLocObj ? subLocObj.distanceKm : 6);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          neighborhood: cleanNeighborhood,
          city: validatedArea,
          area: validatedArea,
          cartItems,
          paymentMethod: finalPaymentMethod,
          distanceKm: dist,
          subLocation: selectedSubLocation,
          deliveryDate: checkoutFormData.deliveryDate,
          deliverySlot: checkoutFormData.deliverySlot
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCreatedOrder(data.order);
        setCartItems([]); // flush cart
        setCheckoutActive(false);
        setShowPreCheckoutModal(false);
        toast.success("Order placed successfully! Milling will begin shortly.");
        if (typeof window !== "undefined") {
          localStorage.setItem("last_tracking_id", data.orderId || data.order?.id);
        }
      } else {
        const errMsg = data.error || "Failed to process checkout transaction. Try again.";
        setCheckoutError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      console.error("Checkout submission error fallback:", err);
      // Fail-safe client side order creation so customer orders process 100% reliably
      const numericId = Math.floor(100000 + Math.random() * 900000);
      const fallbackOrderId = "BDEC-" + numericId;
      const subtotal = cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const deliveryCharges = subtotal >= 3000 ? 0 : Math.round(dist * 50);
      const fallbackOrder = {
        id: fallbackOrderId,
        customer: { name: name.trim(), phone: phone.trim(), address: fullAddress, area: validatedArea, neighborhood: cleanNeighborhood },
        items: [...cartItems],
        paymentMethod: finalPaymentMethod,
        subtotal,
        deliveryCharges,
        discount: 0,
        total: subtotal + deliveryCharges,
        deliveryDate: checkoutFormData.deliveryDate,
        status: "Order Placed",
        statusHistory: [
          { status: "Order Placed", time: new Date().toLocaleTimeString(), detail: "Order successfully received at Babay Dee central system" }
        ],
        createdAt: new Date().toISOString()
      };

      // Direct client-side insert to Supabase & push to Ntfy
      await insertOrderToSupabase(fallbackOrder);
      await sendNtfyNotification(fallbackOrder);

      setCreatedOrder(fallbackOrder);
      setCartItems([]);
      setCheckoutActive(false);
      setShowPreCheckoutModal(false);
      toast.success("Order placed successfully! Milling will begin shortly.");
      if (typeof window !== "undefined") {
        localStorage.setItem("last_tracking_id", fallbackOrderId);
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Handle newly added customer review dynamically
  const handleAddNewReview = (newRev: Review) => {
    setReviews((prev) => {
      const updated = [newRev, ...prev];
      saveStoredReviews(updated);
      setStoredReviews(updated);
      return updated;
    });
  };

  // Filter products catalog
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch =
      (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.desc || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort filtered products
  if (sortOption === "price-asc") {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (sortOption === "price-desc") {
    filteredProducts.sort((a, b) => b.price - a.price);
  } else if (sortOption === "alphabetic") {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans relative select-none pb-16 md:pb-0">
      
      {/* 1. Custom Ripple & Pointer follow Highlights (Desktop Only) */}
      {isDesktop && (
        <>
          {/* Subtle cursor outer ring */}
          <div
            className="fixed top-0 left-0 w-6 h-6 border-2 border-amber-500 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-all duration-75 mix-blend-difference z-50 ease-out"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`,
              transform: `translate(-50%, -50%) scale(${cursorHovering ? 1.5 : 1})`,
            }}
          />
          {/* Subtle cursor dot */}
          <div
            className="fixed top-0 left-0 w-1.5 h-1.5 bg-blue-600 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`
            }}
          />
          {/* Click Ripple effect list mapping */}
          {ripples.map((rip) => (
            <div
              key={rip.id}
              className="fixed rounded-full border border-amber-500/60 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50 duration-1000 ease-out grow-ripple"
              style={{
                left: `${rip.x}px`,
                top: `${rip.y}px`,
              }}
            />
          ))}
          <style>{`
            .grow-ripple {
              animation: ripGrowth 1.1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
            }
            @keyframes ripGrowth {
              0% { width: 0px; height: 0px; opacity: 1; }
              100% { width: 90px; height: 90px; opacity: 0; }
            }
          `}</style>
        </>
      )}

      {/* GSAP Smooth Scroll Progress Indicator */}
      <GsapTopProgressBar />

      {/* 2. Top-bar info banner */}
      <div className="bg-slate-900 text-yellow-400 text-[11px] font-medium py-2 px-4 shadow-sm z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1">
          <div className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            <span>Serving Rawalpindi & Islamabad Households Daily</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline">🕗 Mill Timings: 8:00 AM — 9:00 PM</span>
            <a href="tel:+923215010846" className="font-bold text-yellow-400 hover:underline flex items-center gap-1 cursor-pointer">
              <span>📞 Call Dispatch:</span>
              <span className="underline font-mono">+92 321 5010846</span>
            </a>
          </div>
        </div>
      </div>

      {/* 3. Sticky Navigation Header */}
      <header
        id="main-app-header"
        className={`w-full z-40 transition-all duration-300 bg-white border-b border-slate-100 ${
          isSticky
            ? "fixed top-0 py-1.5 md:py-0.5 shadow-sm"
            : "relative py-2.5 md:py-1 shadow-2xs"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col gap-1.5 md:gap-0.5">
          
          {/* Upper Part of Nav Bar */}
          <div className="relative flex items-center justify-between w-full min-h-[52px] sm:min-h-[56px] md:min-h-[60px]">
            
            {/* Left: Brand Logo Emblem + Mobile Title */}
            <div
              onClick={() => {
                setActiveTab("home");
                setCheckoutActive(false);
                setCreatedOrder(null);
              }}
              className="flex items-center gap-2 cursor-pointer shrink-0 group z-10"
            >
              {/* Round emblem logo sized to match the navbar height */}
              <div className="h-[52px] w-[52px] sm:h-[56px] sm:w-[56px] md:h-[60px] md:w-[60px] rounded-full shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                <Logo className="w-full h-full object-contain" showText={false} />
              </div>
              
              {/* Mobile-only website name title */}
              <div className="flex flex-col text-left md:hidden">
                <h1 className="font-display font-black text-xs sm:text-sm leading-tight text-slate-900 uppercase tracking-tight flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <span>Babay Dee</span>
                  <span className="text-blue-600 font-extrabold tracking-tight">Atta Chakki</span>
                </h1>
                <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  100% Pure Organic
                </p>
              </div>
            </div>

            {/* Center: Website Name on PC Screen ONLY (Single Line, Top Middle, Playfair Brand Font Style) */}
            <div
              onClick={() => {
                setActiveTab("home");
                setCheckoutActive(false);
                setCreatedOrder(null);
              }}
              className="hidden md:flex items-center justify-center text-center cursor-pointer group absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 whitespace-nowrap"
            >
              <h1 className="font-brand font-extrabold text-2xl lg:text-3xl xl:text-4xl text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors whitespace-nowrap drop-shadow-2xs flex items-center gap-2.5">
                <span>Babay Dee</span>
                <span className="text-blue-600 font-extrabold tracking-tight">Atta Chakki</span>
              </h1>
            </div>

            {/* Right: Quick Action Widgets (Wishlist & Basket visible on Mobile; Call badge & Order Tracker added on PC) */}
            <div className="flex items-center gap-2 sm:gap-3 z-10">
              {/* Call dispatch button with direct tel dialer link */}
              <a
                href="tel:+923215010846"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 hover:bg-blue-50 text-blue-600 transition-all shadow-2xs cursor-pointer shrink-0"
                title="Call Mill Dispatch (+92 321 5010846)"
                aria-label="Call Mill Dispatch (+92 321 5010846)"
              >
                <Phone className="w-4 h-4 text-blue-600 fill-blue-100" />
              </a>

              {/* Wishlist icon button (visible on mobile and desktop) */}
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback(15);
                  setIsWishlistOpen(true);
                }}
                aria-label={`View Saved Wishlist (${wishlistIds.length} items)`}
                className="p-1.5 sm:p-2 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors relative cursor-pointer"
                title="Saved Wishlist"
              >
                <Heart className="w-4 h-4 text-rose-500 fill-rose-50" />
                {wishlistIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black rounded-full text-[9px] min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-xs border border-white animate-pulse">
                    {wishlistIds.length}
                  </span>
                )}
              </button>

              {/* Order Tracker shortcut (desktop only) */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("tracker");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                aria-label="Track previous order status"
                className={`hidden md:flex w-8 h-8 lg:w-9 lg:h-9 items-center justify-center rounded-full cursor-pointer transition-colors relative bg-slate-50 border border-slate-200 ${
                  activeTab === "tracker" ? "text-blue-600 border-blue-300 bg-blue-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Truck className="w-4 h-4" />
              </button>

              {/* Basket Icon button (visible on mobile and desktop) */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                id="header-basket-btn"
                aria-label="Open shopping basket"
                className={`bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-full px-3 py-1 sm:px-4 sm:py-1.5 flex items-center gap-2 shadow-xs transition-all active:scale-95 duration-200 cursor-pointer text-xs ${
                  pulseBasket ? "animate-basket-pulse" : ""
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Basket</span>
                <span className="bg-amber-400 text-slate-950 font-black rounded-full px-2 py-0.5 text-[10px]">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Pages Navigation DIRECTLY AT THE BOTTOM OF NAV BAR (PC/Desktop Screen Only) */}
          <div className="hidden md:flex items-center justify-center pt-1 border-t border-slate-100">
            <nav className="flex items-center justify-center flex-wrap gap-1">
              {[
                { id: "home", label: "Home" },
                { id: "shop", label: "Store Catalog" },
                { id: "categories", label: "Categories" },
                { id: "about", label: "About Us" },
                { id: "contact", label: "Contact" },
                { id: "tracker", label: "Track Order" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setCheckoutActive(false);
                    setCreatedOrder(null);
                    if (tab.id === "shop") {
                      setSelectedCategory("all");
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id && !checkoutActive
                      ? "bg-blue-600 text-white shadow-2xs scale-105 font-extrabold"
                      : "text-slate-700 hover:text-blue-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

        </div>
      </header>

      {/* Adjust content position on scroll trigger */}
      {isSticky && <div className="h-[44px] hidden md:block" />}

      {/* Main Container Stage */}
      <main className="flex-1 overflow-hidden">
        <React.Suspense fallback={<div className="min-h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-600 animate-spin" /></div>}>
          <AnimatePresence mode="wait">
          {createdOrder ? (
            <motion.div
              key="order-success"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-4xl mx-auto px-4 py-8"
            >
              <OrderSuccessView
                order={createdOrder}
                onClose={() => setCreatedOrder(null)}
                onTrack={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("last_tracking_id", createdOrder.id);
                  }
                  setActiveTab("tracker");
                  setCreatedOrder(null);
                }}
                onReorder={() => {
                  setCartItems((prevItems) => {
                    const merged = [...prevItems];
                    createdOrder.items.forEach((newItem) => {
                      const existsIdx = merged.findIndex((item) => item.id === newItem.id);
                      if (existsIdx !== -1) {
                        merged[existsIdx] = {
                          ...merged[existsIdx],
                          quantity: merged[existsIdx].quantity + newItem.quantity,
                        };
                      } else {
                        merged.push({ ...newItem });
                      }
                    });
                    return merged;
                  });
                  // Trigger falling grains burst at the center of screen
                  window.dispatchEvent(
                    new CustomEvent("grain-rain", {
                      detail: { type: "add-to-cart", x: window.innerWidth / 2, y: window.innerHeight / 2 }
                    })
                  );
                  setIsCartOpen(true);
                  setPulseBasket(true);
                  setTimeout(() => {
                    setPulseBasket(false);
                  }, 800);
                  setCreatedOrder(null);
                }}
              />
            </motion.div>
          ) : activeTab === "home" && !checkoutActive ? (
            <motion.div
              key="home"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-16"
            >
            {/* HERO SECTION WITH THREEJS BACKGROUND AND SACK */}
            <section className="relative w-full h-[620px] max-md:h-auto max-md:py-16 bg-slate-950 overflow-hidden flex items-center">
              
              {/* Slideshow background (Full-bleed hardware-accelerated CSS transition) */}
              <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
                <div 
                  className="flex h-full absolute left-0 top-0 transition-transform duration-1000 ease-in-out"
                  style={{ 
                    transform: `translateX(-${slideshowIndex * 25}%)`,
                    width: "400%"
                  }}
                >
                  {heroImages.map((img, idx) => (
                    <div key={idx} className="w-[25%] h-full relative shrink-0 bg-slate-900">
                      <img
                        src={img}
                        alt={`Babay Dee Atta Chakki Organic Flour Mill Grain ${idx + 1}`}
                        width="1280"
                        height="720"
                        loading={idx === 0 ? "eager" : "lazy"}
                        // @ts-ignore
                        fetchPriority={idx === 0 ? "high" : "low"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                      {/* Rich organic fallback gradient backdrop in case image fails or loads slowly */}
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 -z-10" />
                    </div>
                  ))}
                </div>
                {/* Clean dark soft overlay ensuring high contrast and pristine legibility */}
                <div className="absolute inset-0 bg-slate-950/50 z-10" />
              </div>

              <div className="max-w-7xl mx-auto px-4 w-full relative z-20">
                {/* Left Text Column - Transparent text written directly over the images */}
                <div className="relative max-w-2xl w-full p-0 flex flex-col justify-center max-md:text-center text-left">
                  
                  {/* Inner text container placed above background */}
                  <div className="space-y-6">
                    <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-slate-100 font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-white/20">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span>Est. 1994 • Pure Flour Milling</span>
                    </span>

                    <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight tracking-tight drop-shadow-md">
                      Natural Stone-Grounded <br className="hidden sm:inline" />
                      <FlipText className="text-blue-400 font-black tracking-tight" duration={2.2} loop={true}>
                        Fresh Chakki Atta
                      </FlipText>
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl font-medium drop-shadow-xs">
                      Discover raw flour purity at Babay Dee Atta Chakki. We source high-grade local grains and grind them under slow stone pressure at low temperatures. Certified zero preservatives, zero bleach, zero additives — delivering wholesome organic nourishment straight to Rawalpindi &amp; Islamabad.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start items-center">
                      <GsapMagnetic strength={0.3}>
                        <button
                          onClick={() => {
                            setActiveTab("shop");
                            setSelectedCategory("all");
                          }}
                          id="hero-shop-now-btn"
                          className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs px-6 py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Shop Now</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </GsapMagnetic>
                      <GsapMagnetic strength={0.25}>
                        <button
                          onClick={() => {
                            setActiveTab("categories");
                          }}
                          id="hero-categories-btn"
                          className="bg-white/10 hover:bg-white/25 border border-white/30 active:scale-98 text-white font-bold text-xs px-6 py-3.5 rounded-lg shadow-sm transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-xs"
                        >
                          <span>Browse Categories</span>
                        </button>
                      </GsapMagnetic>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* INTERACTIVE 3D STONE-MILL TECHNOLOGY */}
            <section id="interactive-3d-mill" className="max-w-7xl mx-auto px-4 py-8 md:py-12">
              <AnimeScrollReveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center bg-white border border-slate-100 rounded-3xl p-6 md:p-12 shadow-xs relative overflow-hidden">
                  
                  {/* Accent ambient glow */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20 z-0" />
                  
                  {/* Left Column: Descriptive Text */}
                  <div className="lg:col-span-7 space-y-6 relative z-10 text-left max-lg:text-center">
                    <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 font-mono font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-blue-100">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>Traditional Stone-Mill Technology</span>
                    </span>
                    
                    <h3 className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight leading-tight">
                      Experience Our Authentic <br />
                      Interactive 3D Stone Chakki
                    </h3>
                    
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl font-medium">
                      Take control of our virtual milling station below! Rotate the high-precision 3D flour sack, feel the quality of raw grains, and listen to the real-time synthesized hum of traditional slow stone pressure. At Babay Dee, we keep milling temperatures low to safeguard natural nutrients and preserve healthy wheat germ.
                    </p>
                    
                    <div className="flex flex-wrap gap-4 pt-2 justify-start max-lg:justify-center">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/50">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Web Audio Synth Active</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column: 3D Mill Container */}
                  <div className="lg:col-span-5 flex justify-center items-center relative z-10 w-full">
                    <div className="w-full max-w-sm">
                      <React.Suspense fallback={<div className="h-64 w-full bg-slate-900/40 rounded-2xl animate-pulse" />}>
                        <FlourSack3D />
                      </React.Suspense>
                    </div>
                  </div>
                </div>
              </AnimeScrollReveal>
            </section>

            {/* WHY CHOOSE US (Sourced brand values) */}
            <React.Suspense fallback={<div className="h-64 w-full bg-slate-100 rounded-2xl animate-pulse my-8 max-w-7xl mx-auto" />}>
              <WhyChooseUs />
            </React.Suspense>

            {/* FRESHLY SOURCED PRODUCTS - ORBITAL IMAGE WHEEL */}
            <section className="max-w-7xl mx-auto px-4 my-8">
              <AnimeScrollReveal>
                <div className="bg-gradient-to-b from-stone-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 border border-amber-500/20 shadow-2xl relative overflow-hidden min-h-[380px]">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                  <React.Suspense fallback={<div className="h-72 w-full bg-slate-900/50 rounded-2xl animate-pulse" />}>
                    <OrbitalImageWheel
                      images={freshSourcedOrbitalItems}
                      title="Freshly Sourced Products"
                      subtitle="Slow stone-ground whole wheat flours, fresh granaries & wholesome daliyas"
                      onAddToCart={(item, ev) => {
                        const targetObj = (item as any).productObj || products.find((p) => String(p.id) === String(item.id));
                        if (targetObj) {
                          handleAddToCart(targetObj, 1, ev);
                        }
                      }}
                      onViewDetails={(item) => {
                        const targetObj = (item as any).productObj || products.find((p) => String(p.id) === String(item.id));
                        if (targetObj) {
                          setSelectedProduct(targetObj);
                        }
                      }}
                    />
                  </React.Suspense>
                </div>
              </AnimeScrollReveal>
            </section>

            {/* POPULAR PRODUCTS IN AREA - ORBITAL IMAGE WHEEL */}
            <section className="max-w-7xl mx-auto px-4 my-8">
              <AnimeScrollReveal delay={120}>
                <div className="bg-gradient-to-b from-slate-900 via-amber-950/40 to-slate-950 text-white rounded-3xl p-6 sm:p-10 border border-amber-500/25 shadow-2xl relative overflow-hidden min-h-[380px]">
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
                  <React.Suspense fallback={<div className="h-72 w-full bg-slate-900/50 rounded-2xl animate-pulse" />}>
                    <OrbitalImageWheel
                      images={popularAreaOrbitalItems}
                      title="Popular In Your Area"
                      subtitle="Top rated flour & daal choices preferred by households in Rawalpindi & Islamabad"
                      onAddToCart={(item, ev) => {
                        const targetObj = (item as any).productObj || products.find((p) => String(p.id) === String(item.id));
                        if (targetObj) {
                          handleAddToCart(targetObj, 1, ev);
                        }
                      }}
                      onViewDetails={(item) => {
                        const targetObj = (item as any).productObj || products.find((p) => String(p.id) === String(item.id));
                        if (targetObj) {
                          setSelectedProduct(targetObj);
                        }
                      }}
                    />
                  </React.Suspense>
                </div>
              </AnimeScrollReveal>
            </section>

            {/* CUSTOMER REVIEWS DYNAMIC MODULE */}
            <React.Suspense fallback={<div className="h-64 w-full bg-slate-100 rounded-2xl animate-pulse my-8 max-w-7xl mx-auto" />}>
              <ReviewsSection
                reviews={reviews}
                onAddReview={handleAddNewReview}
                isLoading={isLoading}
              />
            </React.Suspense>
            </motion.div>
          ) : (activeTab === "shop" || activeTab === "categories") && !checkoutActive ? (
            <motion.div
              key={activeTab === "categories" ? "categories" : "shop"}
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-7xl mx-auto px-4 py-8 space-y-8"
            >
            
            {/* Header description */}
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
                Premium Provisions
              </span>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
                Authentic Store Inventory
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Order 100% natural, unadulterated flour milled daily alongside selected basmati rice, lentils, dry fruits, and herbs. Delivered directly.
              </p>
            </div>

            {/* Search and Advanced sorting filters row using SearchBar component */}
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={(query) => setSearchQuery(query)}
              selectedCategory={selectedCategory}
              onCategoryChange={(category) => setSelectedCategory(category)}
              categories={categories}
              totalResults={filteredProducts.length}
              sortOption={sortOption}
              onSortChange={(sort) => setSortOption(sort)}
              popularTags={["Chakki Atta", "Basmati Rice", "Moong Dal", "Desi Ghee", "Honey", "Shakkar"]}
            />

            {/* Custom Interactive category circles */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider text-center md:text-left">
                Refine by Group
              </h3>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-4 py-2.5 md:py-2 rounded-full font-bold text-xs cursor-pointer transition-all min-h-[44px] md:min-h-0 flex items-center justify-center ${
                    selectedCategory === "all"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🌾 All Catalog
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      if (activeTab === "categories") {
                        setActiveTab("shop"); // switch view to store grid elegantly
                      }
                    }}
                    className={`px-4 py-2.5 md:py-2 rounded-full font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-0 ${
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{cat.id === "flour" ? "🌾" : cat.id === "rice" ? "🍚" : cat.id === "lentils" ? "🫘" : cat.id === "dry_fruits" ? "🥜" : "🌿"}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid render with SkeletonLoaderScreen during Supabase fetch */}
            {isLoading ? (
              <SkeletonLoaderScreen />
            ) : filteredProducts.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl">
                <p className="font-bold text-sm">No merchandise matches your search details.</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="text-xs text-blue-600 font-bold underline mt-2 cursor-pointer"
                >
                  Reset search inputs
                </button>
              </div>
            ) : (
              <AnimeScrollReveal key={selectedCategory + searchQuery}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {filteredProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAddToCart={(prod, qty, ev) => handleAddToCart(prod, qty, ev)}
                      onClick={() => setSelectedProduct(p)}
                      isWishlisted={wishlistIds.includes(p.id)}
                      onToggleWishlist={handleToggleWishlist}
                    />
                  ))}
                </div>
              </AnimeScrollReveal>
            )}

            {/* FREQUENTLY BOUGHT TOGETHER BUNDLES SECTION */}
            <React.Suspense fallback={<div className="h-48 w-full bg-slate-100 rounded-2xl animate-pulse my-6" />}>
              <BundlesSection
                products={products}
                onAddBundleToCart={(bundledProds) => {
                  bundledProds.forEach((item) => {
                    handleAddToCart(item, 1);
                  });
                  toast.wheat("Added bundle combo to your cart! 🛍️");
                }}
              />
            </React.Suspense>
            </motion.div>
          ) : activeTab === "about" && !checkoutActive ? (
            <motion.div
              key="about"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-4xl mx-auto px-4 py-12 space-y-10"
            >
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
                Heritage & Process
              </span>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Our Mill, Our Promise
              </h2>
            </div>

            {/* Main banner image placeholder styled elegantly */}
            <div className="w-full min-h-[400px] sm:min-h-[460px] md:min-h-[520px] rounded-2xl overflow-hidden relative border border-slate-100 flex items-center justify-center bg-slate-900 text-white p-8 sm:p-12">
              <div className="absolute inset-0 bg-slate-950/45 z-10" />
              <div className="z-20 text-center p-6 space-y-4 max-w-2xl">
                <Logo className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 mx-auto mb-3 drop-shadow-lg" showText={false} />
                <h3 className="font-display font-black text-2xl sm:text-3xl md:text-4xl tracking-tight">Babay Dee Atta Chakki Sourcing</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed uppercase tracking-wider font-semibold max-w-lg mx-auto">
                  Milling pure whole wheat flours at Gulrez Phase 3, Rawalpindi since 1994. Three decades of health stewardship.
                </p>
              </div>
            </div>

            {/* Text description details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-xs leading-relaxed text-slate-600">
              
              {/* Left col */}
              <div className="md:col-span-6 space-y-4 text-justify">
                <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                  The Slower, Wholesome Way
                </h4>
                <p>
                  At Babay Dee Atta Chakki, we are committed to providing premium quality, unadulterated, and fresh flour options. Unlike large commercial flour mills that extract beneficial bran and germ and use chemical bleaching agents, we mill our flour in its whole, complete state.
                </p>
                <p>
                  Our traditional stone chakkis grind the wheat at a extremely low speed. This ensures the milling temperature remains low, entirely protecting delicate wheat-germ nutrients, vitamins, and high dietary fiber from heat damage. Your rotis will naturally emerge softer and stay fresh much longer!
                </p>
              </div>

              {/* Right col */}
              <div className="md:col-span-6 space-y-4 text-justify">
                <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Strict Purity Safeguards
                </h4>
                <p>
                  We source our grains directly from clean, local agricultural belts across Punjab, selecting only plump, premium-grade seed stocks. Every single batch is manually inspected, triple de-stoned, and filtered through precise sifting separators before milling.
                </p>
                <p>
                  Our clean-milling setups are open to public verification at Gulrez Rawalpindi. We apply the same level of integrity to our imported Iranian dates, clean hand-sifted lentils, and raw bees flower honey. No compromises on your family's daily vitality.
                </p>
              </div>
            </div>

            {/* Customer FAQs */}
            <React.Suspense fallback={<div className="h-64 w-full bg-slate-100 rounded-2xl animate-pulse my-6" />}>
              <FAQSection />
            </React.Suspense>
            </motion.div>
          ) : activeTab === "contact" && !checkoutActive ? (
            <motion.div
              key="contact"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-5xl mx-auto px-4 py-12 space-y-12"
            >
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
                Liaison Desk
              </span>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Establish Direct Contact
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Contact specifics (5 cols) */}
              <div className="col-span-1 md:col-span-5 space-y-6">
                
                {/* Specific details banner card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
                  <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">
                    Babay Dee Head Office
                  </h3>

                  {/* Phone */}
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Phone Call Callback</h4>
                      <a
                        href="tel:+923215010846"
                        className="text-xs text-blue-600 hover:underline font-mono mt-0.5 font-bold block"
                        title="Click to call +923215010846"
                      >
                        +92-321-5010846
                      </a>
                    </div>
                  </div>

                  {/* Mail */}
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Electronic Mail</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">babaydeeattachakki.info@gmail.com</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-750">Flour Mill Location</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5 font-sans">
                        MAIN High Ct Rd, Gulrez 3 Phase 3 Gulrez Housing Scheme, Rawalpindi, 00666, Pakistan
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct Action triggers */}
                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 space-y-4">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Direct Dispatch Liaisons
                  </h4>
                  <p className="text-xs text-slate-550 leading-relaxed">
                    Have bulk requirements for schools, factories, or hotels in Islamabad/Rawalpindi? Communicate directly with Faisal Farooq on WhatsApp for custom billing quotes.
                  </p>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const message = encodeURIComponent(
                          "Assalam-o-Alaikum Babay Dee! I am interested in inquiring about bulk prices for hotel/commercial grade flour supplies."
                        );
                        window.open(`https://wa.me/923215010846?text=${message}`, "_blank");
                      }}
                      id="contact-whatsapp-btn"
                      className="bg-emerald-500 hover:bg-emerald-600 hover:scale-101 hover:shadow-md text-white font-bold text-xs py-2.5 min-h-[44px] h-11 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Chat on WhatsApp</span>
                      <span>🟢</span>
                    </button>

                    <a
                      href="https://maps.app.goo.gl/Hh5G5YjnhDqT4SD68"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-905 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-bold text-xs py-2.5 min-h-[44px] h-11 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span>Locate on Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Column: Premium Leaflet Embed (7 cols) */}
              <div className="col-span-1 md:col-span-7 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs h-[420px] overflow-hidden flex flex-col justify-between">
                <div className="pb-3 border-b border-slate-50 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Digital Map Guidance</span>
                  <span className="text-[10px] text-slate-400 italic font-mono font-bold uppercase tracking-widest">GULREZ PHASE 3 RWP</span>
                </div>
                
                {/* Visual Placeholder map mockup with real link */}
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl relative flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <span className="text-5xl">📍</span>
                  <div>
                    <h5 className="font-sans font-bold text-slate-800 text-sm">Babay Dee stone-ground Chakki Mill</h5>
                    <p className="text-xs text-slate-500 leading-normal max-w-sm mt-1">
                      Located conveniently on main High Court Road near Gulrez 3 entrance, opposite Punjab police desks. Click below and open native coordinates on maps directly.
                    </p>
                  </div>
                  <a
                    href="https://maps.app.goo.gl/Hh5G5YjnhDqT4SD68"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 p-2 bg-blue-50 hover:bg-blue-105 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Launch Google Maps Route</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
            </motion.div>
          ) : activeTab === "tracker" && !checkoutActive ? (
            <motion.div
              key="tracker"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-7xl mx-auto px-4 py-12"
            >
              <React.Suspense fallback={<div className="h-96 w-full bg-slate-100 rounded-2xl animate-pulse" />}>
                <OrderTracker />
              </React.Suspense>
            </motion.div>
          ) : checkoutActive ? (
            <motion.div
              key="checkout"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-3xl mx-auto px-4 py-12 space-y-8"
            >
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
                Safe Transaction desk
              </span>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Secure Delivery Sourcing
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Confirm your Rawalpindi or Islamabad delivery coordinates. Hand-milling begins on receipt of this order.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Multi-Step Form (7 cols) */}
              <div className="md:col-span-7">
                <React.Suspense fallback={<div className="h-96 w-full bg-slate-100 rounded-2xl animate-pulse" />}>
                  <CheckoutMultiStepForm
                    checkoutFormData={checkoutFormData}
                    setCheckoutFormData={setCheckoutFormData}
                    checkoutError={checkoutError}
                    setCheckoutError={setCheckoutError}
                    selectedArea={selectedArea}
                    setSelectedArea={setSelectedArea}
                    selectedSubLocation={selectedSubLocation}
                    setSelectedSubLocation={setSelectedSubLocation}
                    customDistanceKm={customDistanceKm}
                    setCustomDistanceKm={setCustomDistanceKm}
                    isDetectingLocation={isDetectingLocation}
                    handleDetectLocation={handleDetectLocation}
                    handleCheckoutSubmit={handleCheckoutSubmit}
                    onReturnToCart={() => setCheckoutActive(false)}
                    upcomingDays={upcomingDays}
                    deliverySlots={deliverySlots}
                    cartItemsCount={cartItems.length}
                  />
                </React.Suspense>
              </div>

              {/* Right Summary Basket details (5 cols) */}
              <div className="md:col-span-5 bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-4 text-xs">
                <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2">
                  Basket Ledger summary
                </h4>
                
                {/* List of items */}
                <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                  {cartItems.map((it) => (
                    <div key={it.id} className="flex justify-between font-medium text-slate-650">
                      <span>{it.name} <span className="font-bold text-slate-400">({it.quantity} {it.unit})</span></span>
                      <span className="font-mono font-bold text-slate-800">Rs. {it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Ledger items */}
                <div className="border-t border-slate-200/60 pt-3 space-y-1.5 font-medium text-slate-550">
                  <div className="flex justify-between">
                    <span>Sourced Subtotal</span>
                    <span className="font-mono font-bold text-slate-800">
                      Rs. {cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span className="flex flex-col">
                      <span>Express Delivery Charges</span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Distance: {selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0)} km (@ Rs. 50/km)
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      Rs. {calculateDeliveryCharge(selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0))}
                    </span>
                  </div>

                  {/* Total row block */}
                  <div className="flex justify-between text-sm font-black text-slate-850 pt-2 border-t border-dashed border-slate-200">
                    <span>Grand Ledger Total</span>
                    <span className="text-blue-600 font-mono">
                      Rs. {
                        (() => {
                          const sub = cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
                          const dist = selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0);
                          const del = calculateDeliveryCharge(dist);
                          return sub + del;
                        })()
                      }
                    </span>
                  </div>
                </div>

                {/* Clean security text */}
                <div className="p-3.5 bg-white border border-slate-100 rounded-xl space-y-1.5 leading-relaxed text-slate-500">
                  <h5 className="font-bold text-slate-700 text-[10.5px]">Secure Mill Packing Guarantee</h5>
                  <p className="text-[10px]">
                    We verify every home layout coordinates. Your ordered items will be ground under cold-stone pressure upon dispatch confirmation to retain absolute mineral moisture.
                  </p>
                </div>
              </div>
            </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        </React.Suspense>
      </main>

      {/* 4. Slide-Out Basket drawer widget mapping */}
      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        selectedArea={selectedArea}
        selectedSubLocation={selectedSubLocation}
        onSubLocationChange={(subLoc) => setSelectedSubLocation(subLoc)}
        customDistanceKm={customDistanceKm}
        onCustomDistanceChange={(dist) => setCustomDistanceKm(dist)}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onUndoRemove={handleUndoRemoveItem}
        lastRemovedItem={lastRemovedItem}
        onAreaChange={(area) => {
          setSelectedArea(area);
          setCheckoutFormData((prev) => ({ ...prev, area }));
          if (area === "Rawalpindi") {
            setSelectedSubLocation("Gulrez Housing Scheme (Phase 1-5)");
            setCustomDistanceKm(1.5);
          } else {
            setSelectedSubLocation("Sector I-8 / I-9");
            setCustomDistanceKm(12);
          }
        }}
        onCheckout={() => {
          setIsCartOpen(false);
          setCheckoutActive(true);
        }}
        onDetectLocation={handleDetectLocation}
        isDetectingLocation={isDetectingLocation}
      />

      {/* 4.1. Saved Wishlist Drawer */}
      <React.Suspense fallback={null}>
        <WishlistDrawer
          isOpen={isWishlistOpen}
          onClose={() => setIsWishlistOpen(false)}
          wishlistProducts={products.filter((p) => wishlistIds.includes(p.id))}
          onRemoveWishlist={handleToggleWishlist}
          onAddToCart={(prod) => {
            handleAddToCart(prod, 1);
          }}
        />
      </React.Suspense>

      {/* Mobile Sticky Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setCheckoutActive(false);
          setCreatedOrder(null);
        }}
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
      />

      {/* 4.5. Pre-Checkout Confirmation Modal */}
      <AnimatePresence>
        {showPreCheckoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isPlacingOrder) setShowPreCheckoutModal(false);
              }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Wheat className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-850 text-sm sm:text-base leading-tight">Order Confirmation</h3>
                    <p className="text-[11px] text-slate-400">Final check before cold-stone milling begins</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreCheckoutModal(false)}
                  disabled={isPlacingOrder}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                  aria-label="Close modal"
                >
                  <span className="text-xl font-bold">×</span>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                {/* Error Banner */}
                {checkoutError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                    {checkoutError}
                  </div>
                )}

                {/* Shipping Coordinates */}
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                  <h4 className="font-bold text-slate-700 text-xs tracking-wider uppercase">Delivery Details</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-sans">Customer Name:</span>
                      <p className="font-bold text-slate-800">{checkoutFormData.name}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-sans">Contact Phone:</span>
                      <p className="font-bold text-slate-800">{checkoutFormData.phone}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-slate-400 font-sans">Delivery Area / sub-location:</span>
                      <p className="font-bold text-slate-800">{checkoutFormData.area} — {selectedSubLocation}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-slate-400 font-sans">Complete Home Address:</span>
                      <p className="font-semibold text-slate-700 bg-white border border-slate-200/60 p-2.5 rounded-xl">{checkoutFormData.address}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        <div>
                          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Scheduled Delivery Date</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {(() => {
                              const friendlyDate = upcomingDays.find(d => d.value === checkoutFormData.deliveryDate);
                              return friendlyDate ? `${friendlyDate.label} (${friendlyDate.formattedDate})` : checkoutFormData.deliveryDate;
                            })()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">Scheduled</span>
                    </div>
                  </div>
                </div>

                {/* Items Summary list */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-700 text-xs tracking-wider uppercase">Provisions Sourced</h4>
                  <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50 max-h-40 overflow-y-auto bg-white shadow-inner-sm">
                    {cartItems.map((it) => (
                      <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="font-bold text-slate-700">{it.name}</span>
                          <span className="text-slate-400 font-medium">({it.quantity} {it.unit})</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800">Rs. {it.price * it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ledger charges & summary */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs font-medium text-slate-500">
                    <span>Provisions Subtotal</span>
                    <span className="font-mono font-bold text-slate-800">Rs. {cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0)}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs font-medium text-slate-500">
                    <span className="flex flex-col">
                      <span>Express Delivery Charges</span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Distance: {selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0)} km
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      Rs. {calculateDeliveryCharge(selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-black text-slate-850 pt-2 border-t border-dashed border-slate-200">
                    <span>Grand Ledger Total</span>
                    <span className="text-blue-600 font-mono text-base font-black">
                      Rs. {
                        (() => {
                          const sub = cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
                          const dist = selectedSubLocation === "Custom" ? customDistanceKm : (DELIVERY_LOCATIONS.find(l => l.city === checkoutFormData.area && l.name === selectedSubLocation)?.distanceKm || 0);
                          const del = calculateDeliveryCharge(dist);
                          return sub + del;
                        })()
                      }
                    </span>
                  </div>
                </div>

                {/* Payment assurance */}
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[10px] sm:text-xs leading-relaxed text-slate-600">
                    <span className="font-bold text-slate-800">Cash on Delivery Sourced</span>
                    <p>No upfront digital routing required. Purity audit available on spot verification. Your stone-ground flour retains minerals moisture upon hand dispatch.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={isPlacingOrder}
                  onClick={() => setShowPreCheckoutModal(false)}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer text-center disabled:opacity-50"
                >
                  Go Back & Edit
                </button>
                <button
                  type="button"
                  disabled={isPlacingOrder}
                  onClick={handleFinalOrderSubmit}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                >
                  {isPlacingOrder ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Place Order</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Direct Product Peak Details Overlay */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          allProducts={products}
          reviews={reviews}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(prod, q) => handleAddToCart(prod, q)}
          onSelectProduct={(p) => setSelectedProduct(p)}
        />
      )}

      {/* Global Grain Falling and Burst Animation overlay */}
      <FallingGrains />

      {/* 6. Live Agent Operator Support Chat Widget desk */}
      {!isCartOpen && (
        <React.Suspense fallback={null}>
          <SupportChat />
        </React.Suspense>
      )}

      {/* Progressive Web App Install Prompt */}
      <React.Suspense fallback={null}>
        <PWAInstallPrompt />
      </React.Suspense>

      {/* 7. Footer brand content details */}
      <footer className="bg-slate-900 text-white font-sans border-t-4 border-amber-500 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Logo description column (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <Logo className="w-11 h-11 shrink-0" showText={false} />
              <div>
                <h3 className="font-display font-black text-[15px] uppercase tracking-wide text-white">
                  Babay Dee
                </h3>
                <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider uppercase block">
                  Atta Chakki
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed text-justify">
              Babay Dee Atta Chakki mill has been a household wheat standard in Gulrez housing scheme Rawalpindi and surrounding sectors of Islamabad for over three decades. Milled slowly to retain healthy minerals and wholesome dietary fiber.
            </p>

            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block pt-2 border-t border-slate-800">
              © 1994 — 2026 Babay Dee Inc. All rights reserved.
            </span>
          </div>

          {/* Quick links columns (4 cols) */}
          <div className="md:col-span-4 space-y-4 md:pl-10">
            <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-amber-400">
              Approved Categories
            </h4>
            <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-350">
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setSelectedCategory("flour");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left font-semibold"
              >
                🌾 Milled Atta & Flour
              </button>
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setSelectedCategory("rice");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left font-semibold"
              >
                🍚 Premium Aged Basmati Rice
              </button>
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setSelectedCategory("lentils");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left font-semibold"
              >
                🫘 Triple-Cleaned Pulses & Lentils
              </button>
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setSelectedCategory("dry_fruits");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left font-semibold"
              >
                🥜 Nutritious Sweet Dry Fruits
              </button>
              <button
                onClick={() => {
                  setActiveTab("shop");
                  setSelectedCategory("herbs");
                  setCheckoutActive(false);
                  setCreatedOrder(null);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left font-semibold"
              >
                🌿 Sifted Herbs & Natural Sidr Honey
              </button>
            </div>
          </div>

          {/* Location contact columns (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-amber-400">
              Mill Operator Direct
            </h4>
            
            <div className="space-y-2 text-xs text-slate-350 leading-relaxed font-sans">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>MAIN High Ct Rd, Gulrez 3 Phase 3 Gulrez Housing Scheme, Rawalpindi, Pakistan</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <a
                  href="tel:+923215010846"
                  className="hover:text-amber-400 hover:underline transition-colors font-bold font-mono text-slate-200"
                  title="Click to dial +92 321 5010846"
                >
                  +92 321 5010846 (Dispatch call support)
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <span>babaydeeattachakki.info@gmail.com</span>
              </p>
            </div>

            {/* Micro banner certification */}
            <div className="pt-2.5 border-t border-slate-800 flex items-center gap-2 bg-slate-950/20 p-2.5 rounded-lg">
              <span className="text-xl">🛡️</span>
              <div className="text-[10px] text-slate-400 leading-tight">
                <p className="font-bold text-slate-300">100% Purity Certification</p>
                <p>No chemical bleaching or stone powders added. Guarantees raw wholesome health.</p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Pristine Touch-friendly Persistent Mobile bottom navigation bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40 md:hidden h-16 flex items-center justify-around px-1 pb-safe">
        <button
          onClick={() => {
            setActiveTab("home");
            setCheckoutActive(false);
            setCreatedOrder(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors ${
            activeTab === "home" && !checkoutActive ? "text-amber-800 font-extrabold" : "text-slate-500 font-medium"
          }`}
        >
          <Wheat className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("shop");
            setSelectedCategory("all");
            setCheckoutActive(false);
            setCreatedOrder(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors ${
            (activeTab === "shop" || activeTab === "categories") && !checkoutActive ? "text-amber-800 font-extrabold" : "text-slate-500 font-medium"
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">Store</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("about");
            setCheckoutActive(false);
            setCreatedOrder(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors ${
            activeTab === "about" && !checkoutActive ? "text-amber-800 font-extrabold" : "text-slate-500 font-medium"
          }`}
        >
          <Info className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">About</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("contact");
            setCheckoutActive(false);
            setCreatedOrder(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors ${
            activeTab === "contact" && !checkoutActive ? "text-amber-800 font-extrabold" : "text-slate-500 font-medium"
          }`}
        >
          <Phone className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">Contact</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("tracker");
            setCheckoutActive(false);
            setCreatedOrder(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors ${
            activeTab === "tracker" && !checkoutActive ? "text-amber-800 font-extrabold" : "text-slate-500 font-medium"
          }`}
        >
          <Truck className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">Track</span>
        </button>

        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] cursor-pointer transition-colors text-slate-500 font-medium relative"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-amber-500 mb-0.5" />
            <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white font-black rounded-full px-1.5 py-0.5 text-[9px] leading-none shadow-2xs">
              {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
            </span>
          </div>
          <span className="text-[11px] font-bold">Basket</span>
        </button>
      </div>
    </div>
  );
}
