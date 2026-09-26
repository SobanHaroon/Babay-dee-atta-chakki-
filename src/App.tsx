import { CheckoutConfirmation } from "./components/CheckoutConfirmation";
import { pakistanDateKey, upcomingDeliveryDays, formatRupees } from "./lib/commerce";
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
  CheckCircle2,
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
  Zap,
  ListChecks
} from "lucide-react";
import { Product, Category, Review, CartItem, Order, DEFAULT_CATEGORIES } from "./types";



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

import { supabase } from "./lib/supabaseClient";
import { motion, AnimatePresence } from "motion/react";
import { animate } from "animejs";
import { useToast } from "./components/ToastContainer";
import { triggerHapticFeedback, cn } from "./lib/utils";
import CheckoutMultiStepForm, { type CheckoutAddressData } from "./components/CheckoutMultiStepForm";


import { SocialsHoverCard } from "./components/SocialsHoverCard";


import { EditorialHome } from "./components/EditorialHome";

// Lazy-loaded heavy components for optimal mobile Lighthouse performance
const WishlistDrawer = React.lazy(() => import("./components/WishlistDrawer"));
const ReviewsSection = React.lazy(() => import("./components/ReviewsSection"));
const OrderTracker = React.lazy(() => import("./components/OrderTracker"));
const SupportChat = React.lazy(() => import("./components/SupportChat"));
const FAQSection = React.lazy(() => import("./components/FAQSection"));
const WhyChooseUs = React.lazy(() => import("./components/WhyChooseUs"));


export const GOOGLE_MAPS_PLATFORM_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";

export const STORE_EXACT_LOCATION = {
  lat: 33.567348,
  lng: 73.104510,
  address: "Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
  name: "Babay Dee Atta Chakki (Central Depot)"
};

const DELIVERY_SLOTS_DATA = [
  { id: "slot1", name: "Morning", time: "09:00 AM - 12:00 PM", icon: "🌅" },
  { id: "slot2", name: "Afternoon", time: "12:00 PM - 03:00 PM", icon: "☀️" },
  { id: "slot3", name: "Late Afternoon", time: "03:00 PM - 06:00 PM", icon: "🌤️" },
  { id: "slot4", name: "Evening", time: "06:00 PM - 09:00 PM", icon: "🌆" }
];


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
  const pendingProductId = useRef(new URLSearchParams(location.search).get('product'));
  // Store navigation states
  const [activeTab, setActiveTab] = useState<"home" | "shop" | "categories" | "about" | "contact" | "tracker">(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return ['shop', 'categories', 'about', 'contact', 'tracker'].includes(tab || '') ? tab as any : 'home';
  });


  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Dynamically generated upcoming 4 days for preferred delivery picker
  const upcomingDays = upcomingDeliveryDays(4);

  const deliverySlots = DELIVERY_SLOTS_DATA;

  // Loading indicators
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => new URLSearchParams(location.search).get('category') || 'all');
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
  const [cartBounce, setCartBounce] = useState(0);
  const [selectedArea, setSelectedArea] = useState("Islamabad"); // default delivery town, Rawalpindi alternative
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>("Sector I-8 / I-9");
  const [customDistanceKm, setCustomDistanceKm] = useState<number>(12);
  
  // Modals / Overlays
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Fulfillment option: Delivery vs Store Pick Up
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");

  // Checkout stage
  const [checkoutActive, setCheckoutActive] = useState(false);

  useEffect(() => {
    if (checkoutActive) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [checkoutActive]);

  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [customerCoordinates, setCustomerCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isDeliverable, setIsDeliverable] = useState<boolean>(true);
  const [verifiedDeliveryCharge, setVerifiedDeliveryCharge] = useState<number | null>(null);
  const [checkoutFormData, setCheckoutFormData] = useState<CheckoutAddressData>(() => ({
    name: typeof window !== "undefined" ? localStorage.getItem("customer_name") || "" : "",
    phone: typeof window !== "undefined" ? localStorage.getItem("customer_phone") || "" : "",
    email: typeof window !== "undefined" ? localStorage.getItem("customer_email") || "" : "",
    address: "",
    deliveryQuotedAddress: "",
    deliveryQuoteToken: "",
    matchedAddress: "",
    city: "",
    area: "",
    paymentMethod: "Cash on Delivery",
    sendingBank: "Easypaisa (Telenor Bank)",
    transactionId: "",
    deliveryDate: pakistanDateKey(),
    deliverySlot: DELIVERY_SLOTS_DATA[0].name
  }));
  const [checkoutError, setCheckoutError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  // Desktop active custom Cursor state

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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          console.warn(`Resilient recovery: fetch failed or timed out for ${url}`, e);
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
        if (revs && Array.isArray(revs)) setReviews(revs);

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
        .subscribe((status) => {
          console.log("Supabase Realtime subscription status:", status);
        });
    }

    // Track scroll
    const handleScroll = () => {
      setIsSticky(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);

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

  // Save cart state to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem("babay_dee_cart", JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to save cart state to localStorage:", e);
    }
  }, [cartItems]);

  // Scroll to top smoothly when tab, checkout status, or order status changes
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }, [activeTab, checkoutActive, createdOrder]);

  // Synchronize dynamic URL query parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const categoryParam = params.get('category');
    if (categoryParam && DEFAULT_CATEGORIES.some(c => c.id === categoryParam)) setSelectedCategory(categoryParam);
    const query = params.get('q');
    if (query) setSearchQuery(query);
    // Parse tab parameter
    const tabParam = params.get("tab");
    if (tabParam && ["home", "shop", "categories", "about", "contact", "tracker"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }

    // Support direct tracking URL parameters (e.g. ?tab=tracker&order=BDEC-...)
    const orderParam = params.get("order") || params.get("orderId") || params.get("track");
    if (orderParam && typeof window !== "undefined") {
      localStorage.setItem("last_tracking_id", orderParam.toUpperCase());
    }

    // Support #track=BDEC-... hash deep link
    if (typeof window !== "undefined" && window.location.hash.includes("track=")) {
      const hashTrackId = window.location.hash.split("track=")[1].split("&")[0];
      if (hashTrackId) {
        localStorage.setItem("last_tracking_id", hashTrackId.toUpperCase());
        setActiveTab("tracker");
      }
    }

    // Parse product parameter for detail view modal
    const productParam = params.get("product") || pendingProductId.current;
    if (productParam && products.length > 0) {
      const match = products.find((p) => p.id === productParam);
      if (match) {
        setSelectedProduct(match);
        pendingProductId.current = null;
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
      if (pendingProductId.current) params.set('product', pendingProductId.current);
      else params.delete("product");
      if (activeTab && activeTab !== "home") {
        params.set("tab", activeTab);
      } else {
        params.delete("tab");
      }
    }
    
    if (activeTab === 'shop' && selectedCategory !== 'all') params.set('category', selectedCategory); else params.delete('category');
    if (activeTab === 'shop' && searchQuery) params.set('q', searchQuery); else params.delete('q');
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    if (newUrl !== location.pathname + location.search) window.history.pushState(null, "", newUrl);
    const canonical = new URLSearchParams();
    if (selectedProduct) canonical.set('product', selectedProduct.id);
    else if (activeTab !== 'home') canonical.set('tab', activeTab);
    const url = 'https://babaydeeattachakki.com/' + (canonical.size ? '?' + canonical : '');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
    document.querySelector('meta[name="robots"]')?.setAttribute('content', activeTab === 'tracker' || checkoutActive || createdOrder ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  }, [activeTab, selectedProduct, selectedCategory, searchQuery, checkoutActive, createdOrder]);

  useEffect(() => {
    const onBack = () => {
      const params = new URLSearchParams(location.search);
      const next = params.get('tab') || 'home';
      if (['home','shop','categories','about','contact','tracker'].includes(next)) setActiveTab(next as any);
      setSelectedCategory(params.get('category') || 'all');
      setSearchQuery(params.get('q') || '');
      setSelectedProduct(products.find(p => p.id === params.get('product')) || null);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [products]);
  // Dynamically change the document title based on the active Tab or Selected Product
  useEffect(() => {
    if (selectedProduct) {
      document.title = `Babay Dee | ${selectedProduct.name} - Premium Quality`;
      return;
    }

    switch (activeTab) {
      case "shop":
        document.title = "Babay Dee | Shop Fresh Flour & Organic Grocery";
        break;
      case "categories":
        document.title = "Babay Dee | Browse Categories & Grain Selections";
        break;
      case "about":
        document.title = "Babay Dee | Our Traditional Chakki & Heritage";
        break;
      case "contact":
        document.title = "Babay Dee | Get in Touch & Delivery Status";
        break;
      case "tracker":
        document.title = "Babay Dee | Live Order Milling & Delivery Tracker";
        break;
      case "home":
      default:
        document.title = "Babay Dee | Freshly Milled Whole Wheat Atta & Pure Grains";
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

    setCartBounce(count => count + 1);
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

    const { name, phone, address } = checkoutFormData;
    if (!name.trim() || !phone.trim()) {
      const errMsg = "Please fill in all customer inputs (Name and Phone number).";
      setCheckoutError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (fulfillmentType !== "pickup" && (!address.trim() || !checkoutFormData.deliveryQuoteToken || checkoutFormData.deliveryQuotedAddress !== address.trim() || verifiedDeliveryCharge === null || !isDeliverable || !customerCoordinates)) {
      const message = "Calculate delivery charges for your address before continuing.";
      setCheckoutError(message); toast.error(message); return;
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
    if (isPlacingOrder) return;
    triggerHapticFeedback([40, 60, 50]);
    setIsPlacingOrder(true);
    setCheckoutError("");

    const isPickupOrder = fulfillmentType === "pickup";
    if (!isPickupOrder && (verifiedDeliveryCharge === null || !isDeliverable || !checkoutFormData.deliveryQuoteToken || checkoutFormData.deliveryQuotedAddress !== checkoutFormData.address.trim())) { setIsPlacingOrder(false); setCheckoutError("Calculate delivery charges for your address before ordering."); return; }
    const { name, phone, email, address, city, area } = checkoutFormData;
    const finalAddress = isPickupOrder
      ? "Store Depot: Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi"
      : address.trim();
    const resolvedCity = (city || "").trim();
    const resolvedArea = (area || "").trim();
    const finalPaymentMethod = isPickupOrder ? "Pay at Store Counter" : "Cash on Delivery";

    const custLat = customerCoordinates?.lat;
    const custLng = customerCoordinates?.lng;
    const dist = isPickupOrder ? 0 : customDistanceKm;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: (email || "").trim(),
          address: finalAddress,
          deliveryQuoteToken: checkoutFormData.deliveryQuoteToken,
          city: resolvedCity,
          area: resolvedArea,
          subLocation: resolvedArea,
          cartItems,
          paymentMethod: finalPaymentMethod,
          fulfillmentType,
          pickupNotes: (checkoutFormData as any).pickupNotes || "",
          notes: (checkoutFormData as any).notes || "",
          riderTip: (checkoutFormData as any).riderTip || 0,
          distanceKm: dist,
          latitude: custLat,
          longitude: custLng,
          customerLatitude: custLat,
          customerLongitude: custLng,
          customerCoordinates: { lat: custLat, lng: custLng },
          deliveryDate: checkoutFormData.deliveryDate,
          deliverySlot: checkoutFormData.deliverySlot
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const orderObj = data.order || {};
        if (data.emailStatus) {
          orderObj.emailStatus = data.emailStatus;
        }
        setCreatedOrder(orderObj);
        setCartItems([]); // flush cart
        setCheckoutActive(false);
        setShowPreCheckoutModal(false);
        toast.success(isPickupOrder ? "Pickup Order Placed! Your fresh flour is being packed." : "Order placed successfully! Milling will begin shortly.");
        if (data.emailStatus?.delivered) {
          toast.success(`Receipt sent to ${data.emailStatus.recipient || email}!`);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("last_tracking_id", data.orderId || data.order?.id);
          if (email) localStorage.setItem("customer_email", email);
          if (name) localStorage.setItem("customer_name", name);
          if (phone) localStorage.setItem("customer_phone", phone);
        }
      } else {
        const errMsg = data.error || "Failed to process checkout transaction. Try again.";
        setCheckoutError(errMsg);
        if (res.status === 409) {setShowPreCheckoutModal(false);setVerifiedDeliveryCharge(null);setIsDeliverable(false);setCheckoutFormData(prev => ({...prev,deliveryQuoteToken:"",deliveryQuotedAddress:""}));}
        toast.error(errMsg);
      }
    } catch (err) {
      console.error("Checkout submission failed:", err);
      const message = "We could not confirm your order. Your basket has been kept. Please try again or contact the store if the problem continues.";
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Handle newly added customer review dynamically
  const handleAddNewReview = (newRev: Review) => {
    setReviews((prev) => [newRev, ...prev]);
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans relative pb-16 md:pb-0">
      
      <a href="#main-content" className="skip-link">Skip to main content</a>
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

      {/* 3. Sticky Navigation Header (stays permanently fixed to top on PC and Mobile when scrolling down or up) */}
      <header
        id="main-app-header"
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-shadow duration-200 py-1.5 md:py-1"
      >
        {/* Subtle shimmer skeleton loading state when mounted but data is not yet fetched */}
        {isLoading && (
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-200/25 to-transparent animate-shimmer" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500/20 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-shimmer" />
            </div>
          </div>
        )}

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
              {/* Round emblem logo sized almost equal to navbar height with explicit 1/1 aspect ratio & smooth hover transition */}
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-15 md:h-15 lg:w-16 lg:h-16 aspect-square rounded-full shrink-0 flex items-center justify-center overflow-hidden transition-transform duration-300 ease-out hover:scale-105 active:scale-95 will-change-transform transform-gpu cursor-pointer shadow-2xs group-hover:shadow-md"
                style={{ aspectRatio: "1 / 1" }}
              >
                <Logo className="w-16 h-12 sm:w-20 sm:h-14 md:w-24 md:h-16" showText={false} />
              </div>
              
              {/* Mobile-only website name title */}
              <div className="flex flex-col text-left md:hidden">
                <p className="font-display font-black text-xs sm:text-sm leading-tight text-slate-900 uppercase tracking-tight flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <span>Babay Dee</span>
                  <span className="text-blue-600 font-extrabold tracking-tight">Atta Chakki</span>
                </p>
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
              <p className="font-brand font-extrabold text-2xl lg:text-3xl xl:text-4xl text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors whitespace-nowrap drop-shadow-2xs flex items-center gap-2.5">
                <span>Babay Dee</span>
                <span className="text-blue-600 font-extrabold tracking-tight">Atta Chakki</span>
              </p>
            </div>

            {/* Right: Quick Action Widgets */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 z-10">
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
                key={`basket-${cartBounce}`}
                aria-label="Open shopping basket"
                className={`bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-full px-3 py-1 sm:px-4 sm:py-1.5 flex items-center gap-2 shadow-xs transition-all active:scale-95 duration-200 cursor-pointer text-xs ${
                  cartBounce > 0 ? "animate-basket-bounce" : ""
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Basket</span>
                <span className="bg-amber-400 text-slate-950 font-black rounded-full px-2 py-0.5 text-[10px]">
                  {cartItems.length}
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
                <a
                  key={tab.id}
                  href={tab.id === "home" ? "/" : `?tab=${tab.id}`}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    window.scrollTo({top: 0, behavior: "instant"});
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
                </a>
              ))}
            </nav>
          </div>

        </div>
      </header>

      {/* Main Container Stage */}
      <main id="main-content" tabIndex={-1} className="milling-main flex-1 overflow-hidden">

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
                  setCartBounce(count => count + 1);
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
              className="storefront-home"
            >
            <EditorialHome
              products={featuredProducts.length ? featuredProducts : products.filter(p => p.category === 'flour')}
              popular={popularProducts.length ? popularProducts : products.slice(0, 4)}
              onShop={(category = 'all') => { setSelectedCategory(category); setActiveTab('shop'); window.scrollTo({top: 0, behavior: 'instant'}); }}
              onCategories={() => { setActiveTab('categories'); window.scrollTo({top: 0, behavior: 'instant'}); }}
              onProduct={setSelectedProduct}
              onAdd={(product, event) => handleAddToCart(product, 1, event)}
            >
              <React.Suspense fallback={<div className="min-h-64" />}><WhyChooseUs /></React.Suspense>
            </EditorialHome>
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
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
                Authentic Store Inventory
              </h1>
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
              popularTags={["Chakki Atta", "Basmati Rice", "Daal Mong", "Besan", "Kalonji", "Gurr"]}
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
                onSelectProduct={(p) => setSelectedProduct(p)}
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
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Our Mill, Our Promise
              </h1>
            </div>

            {/* Main banner image placeholder styled elegantly */}
            <div className="w-full min-h-[400px] sm:min-h-[460px] md:min-h-[520px] rounded-2xl overflow-hidden relative border border-slate-100 flex items-center justify-center bg-slate-900 text-white p-8 sm:p-12">
              <div className="absolute inset-0 bg-slate-950/45 z-10" />
              <div className="z-20 text-center p-6 space-y-4 max-w-2xl">
                <Logo className="w-44 h-32 sm:w-56 sm:h-40 md:w-64 md:h-48 mx-auto mb-3 drop-shadow-lg" showText={false} />
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
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Establish Direct Contact
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
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
                      <span>Locate on Map</span>
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
                    <span>Open Map Coordinates</span>
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
              className="max-w-6xl mx-auto px-4 py-8 space-y-6"
            >
            <div className="text-center space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-700 bg-amber-100/60 px-3 py-1 rounded-full border border-amber-200/60 inline-block">
                FRESH FROM OUR CHAKKI
              </span>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Checkout
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter your details, calculate delivery, and review your fresh essentials.
              </p>
            </div>

            {cartItems.length === 0 ? (
              <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Your Basket is Currently Empty</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Please add fresh whole wheat chakki atta, basmati rice, triple-cleaned lentils, dry fruits, or spices from our store before proceeding.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutActive(false);
                      setActiveTab("shop");
                      setSelectedCategory("all");
                    }}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer uppercase tracking-wider"
                  >
                    Browse Catalog
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Multi-Step Form (7 cols) */}
                <div className="lg:col-span-8">
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
                    customerCoordinates={customerCoordinates}
                    setCustomerCoordinates={setCustomerCoordinates}
                    isDeliverable={isDeliverable}
                    setIsDeliverable={setIsDeliverable}
                    verifiedDeliveryCharge={verifiedDeliveryCharge}
                    setVerifiedDeliveryCharge={setVerifiedDeliveryCharge}
                    fulfillmentType={fulfillmentType}
                    setFulfillmentType={setFulfillmentType}
                    handleCheckoutSubmit={handleCheckoutSubmit}
                    onReturnToCart={() => setCheckoutActive(false)}
                    upcomingDays={upcomingDays}
                    deliverySlots={deliverySlots}
                    cartItemsCount={cartItems.length}
                  />
                </div>

                <aside className="lg:col-span-4 receipt-panel checkout-basket" aria-label="Order summary">
                  <h3>Your basket <span className="float-right">{cartItems.length} items</span></h3>
                  <ul className="receipt-items">{cartItems.map(item=><li key={item.id}><div><strong>{item.name}</strong><small>{item.quantity} {item.unit}</small></div><span>{formatRupees(item.price*item.quantity)}</span></li>)}</ul>
                  <dl className="receipt-totals"><div><dt>Subtotal</dt><dd>{formatRupees(cartItems.reduce((sum,item)=>sum+item.price*item.quantity,0))}</dd></div><div><dt>Delivery{fulfillmentType !== "pickup" && verifiedDeliveryCharge !== null && <small className="block mt-1">{customDistanceKm.toFixed(2)} km {["area", "sector", "phase", "neighborhood"].includes(checkoutFormData.locationPrecision || "") ? "to matched " + (checkoutFormData.locationPrecision === "neighborhood" ? "neighbourhood" : checkoutFormData.locationPrecision) : "by road"}</small>}</dt><dd>{fulfillmentType === "pickup" ? "Free pickup" : verifiedDeliveryCharge !== null ? formatRupees(verifiedDeliveryCharge) : "Not calculated yet"}</dd></div><div className="receipt-grand-total"><dt>Total</dt><dd>{fulfillmentType !== "pickup" && verifiedDeliveryCharge === null ? "Awaiting delivery charge" : formatRupees(cartItems.reduce((sum,item)=>sum+item.price*item.quantity,0)+(fulfillmentType === "pickup" ? 0 : verifiedDeliveryCharge ?? 0))}</dd></div></dl>
                  <p>{fulfillmentType === "pickup" ? "Collect from our store on Main Gulraiz Phase 3 / High Court Road, Rawalpindi." : "Your delivery charge is calculated from the road distance to the address you enter. Pay when your order arrives."}</p>
                </aside>
              </div>
            )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        </React.Suspense>
      </main>

      {/* 4. Slide-Out Basket drawer widget mapping */}
      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        fulfillmentType={fulfillmentType}
        onFulfillmentTypeChange={setFulfillmentType}
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
        }}
        onCheckout={() => {
          setIsCartOpen(false);
          setCheckoutActive(true);
        }}
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
        cartCount={cartItems.length}
        bounceTrigger={cartBounce}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
      />

      {showPreCheckoutModal && <CheckoutConfirmation
        busy={isPlacingOrder} error={checkoutError}
        onBack={() => setShowPreCheckoutModal(false)} onConfirm={handleFinalOrderSubmit}
        order={{id:"preview",customer:checkoutFormData,items:cartItems,
          fulfillmentType,deliveryDate:checkoutFormData.deliveryDate,deliverySlot:checkoutFormData.deliverySlot,
          paymentMethod:fulfillmentType === "pickup" ? "Pay at the store" : "Cash on delivery",
          subtotal:cartItems.reduce((sum,item)=>sum+item.price*item.quantity,0),
          deliveryCharges:fulfillmentType === "pickup" ? 0 : verifiedDeliveryCharge ?? 0,
          total:cartItems.reduce((sum,item)=>sum+item.price*item.quantity,0)+(fulfillmentType === "pickup" ? 0 : verifiedDeliveryCharge ?? 0),
          deliveryDetails:{distanceKm:customDistanceKm,locationPrecision:checkoutFormData.locationPrecision},status:"Review",statusHistory:[],createdAt:new Date().toISOString()}}
      />}

      {/* 5. Direct Product Peak Details Overlay */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(prod, q, e) => handleAddToCart(prod, q, e)}
          onSelectProduct={(p) => setSelectedProduct(p)}
          isWishlisted={(id) => wishlistIds.includes(id)}
          onToggleWishlist={handleToggleWishlist}
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

      {/* 7. Footer brand content details */}
      <footer className="relative z-10 bg-slate-900 text-white font-sans border-t-4 border-amber-500 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 items-start">
          
          {/* Logo description column (3.5 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <Logo className="w-20 h-14 shrink-0" showText={false} />
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

          {/* Quick links columns (2.5 cols) */}
          <div className="lg:col-span-3 space-y-4 lg:pl-4">
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

          {/* Location contact columns (3 cols) */}
          <div className="lg:col-span-3 space-y-3.5">
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
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-lg">🛡️</span>
                <div className="text-[10px] text-slate-400 leading-tight">
                  <p className="font-bold text-slate-300">100% Purity Certification</p>
                  <p>No chemical bleaching or stone powders added.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Socials Hover Card Column (2 cols) */}
          <div className="lg:col-span-2 flex flex-col items-center sm:items-start lg:items-center space-y-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-amber-400 text-center">
              Official Channels
            </h4>
            <SocialsHoverCard />
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
            <ShoppingBag key={`sticky-basket-${cartBounce}`} className={`w-5 h-5 text-amber-500 mb-0.5 ${cartBounce > 0 ? "animate-basket-bounce" : ""}`} />
            <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white font-black rounded-full px-1.5 py-0.5 text-[9px] leading-none shadow-2xs">
              {cartItems.length}
            </span>
          </div>
          <span className="text-[11px] font-bold">Basket</span>
        </button>
      </div>
    </div>
  );
}
