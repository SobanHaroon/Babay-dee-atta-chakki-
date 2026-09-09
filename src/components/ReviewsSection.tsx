import React, { useState, useEffect, useRef } from "react";
import { Review } from "../types";
import { Star, MessageSquarePlus, UserCheck, CheckCircle } from "lucide-react";
import { SkeletonReviewItem } from "./Skeleton";
import { AnimeHover3D } from "./AnimatedComponents";

interface ReviewsSectionProps {
  reviews: Review[];
  onAddReview: (r: Review) => void;
  isLoading: boolean;
}

export function ReviewsSection({ reviews, onAddReview, isLoading }: ReviewsSectionProps) {
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formCity, setFormCity] = useState("Islamabad");
  const [formText, setFormText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const reviewsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);

  // Smooth pass-through page scroll when reviews list reaches top or bottom boundary
  useEffect(() => {
    const container = reviewsContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 3;
      const isAtTop = scrollTop <= 3;

      if ((e.deltaY > 0 && isAtBottom) || (e.deltaY < 0 && isAtTop)) {
        window.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 3;
      const isAtTop = scrollTop <= 3;

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartYRef.current - currentY; // positive = swiping up (scrolling down)

      if ((deltaY > 0 && isAtBottom) || (deltaY < 0 && isAtTop)) {
        window.scrollBy({ top: deltaY, behavior: "auto" });
        touchStartYRef.current = currentY;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formText.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formName.trim(),
          rating: formRating,
          city: formCity,
          review: formText.trim(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.review) {
          onAddReview(result.review);
          setFormName("");
          setFormText("");
          setFormRating(5);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 4500);
        }
      }
    } catch (err) {
      console.error("Failed to post consumer review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="customer-reviews-section" className="py-12 bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
            Real Customer Sentiment
          </span>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
            Verified Customer Reviews
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Read transparent opinions left by local households in Rawalpindi and Islamabad. 100% authentic ratings based on actual product shipments.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form to submit review (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
              <MessageSquarePlus className="w-4.5 h-4.5 text-blue-600" />
              <span>Share Your Feedback</span>
            </h3>

            {showSuccess ? (
              <div className="bg-green-50 border border-green-150 p-4 rounded-xl text-center space-y-2 animate-fade-in">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                <h4 className="font-bold text-green-800 text-sm">Review Submitted!</h4>
                <p className="text-xs text-green-600 leading-normal">
                  Your feedback has been saved and posted immediately. Thank you for supporting local businesses like Babay Dee!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label htmlFor="rev-form-name" className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                    Your Full Name
                  </label>
                  <input
                    id="rev-form-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ch. Mohammad Asif"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none transition-all font-medium text-slate-800 h-10"
                  />
                </div>

                {/* Rating & City Gridded */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="rev-form-rating" className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Star Rating
                    </label>
                    <select
                      id="rev-form-rating"
                      value={formRating}
                      onChange={(e) => setFormRating(parseInt(e.target.value))}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none cursor-pointer text-slate-700 h-10"
                    >
                      <option value={5}>5 Stars ★★★★★</option>
                      <option value={4}>4 Stars ★★★★☆</option>
                      <option value={3}>3 Stars ★★★☆☆</option>
                      <option value={2}>2 Stars ★★☆☆☆</option>
                      <option value={1}>1 Star  ★☆☆☆☆</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-form-city" className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                      Sourced City Area
                    </label>
                    <select
                      id="rev-form-city"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none cursor-pointer text-slate-700 h-10"
                    >
                      <option value="Islamabad">Islamabad</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                    </select>
                  </div>
                </div>

                {/* Feedback text */}
                <div className="space-y-1">
                  <label htmlFor="rev-form-text" className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                    Product & Service Review
                  </label>
                  <textarea
                    id="rev-form-text"
                    required
                    rows={4}
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="How is our flour purity, smell, milling and packing? Let other local families know..."
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none transition-all font-medium text-slate-800 resize-none leading-relaxed"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="submit-review-btn"
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all uppercase tracking-wider"
                >
                  {isSubmitting ? "Submitting..." : "Publish Review"}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: List of reviews newest first (7 cols) */}
          <div
            ref={reviewsContainerRef}
            className="lg:col-span-7 space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar touch-pan-y"
          >
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonReviewItem key={`review-skeleton-${i}`} />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium text-sm">
                No reviews found. Be the first to leave one!
              </div>
            ) : (
              reviews.map((rev) => (
                <AnimeHover3D key={rev.id}>
                  <div
                    id={`review-item-${rev.id}`}
                    className="p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 shadow-xs hover:shadow-sm transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>{rev.name}</span>
                          <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            <UserCheck className="w-2.5 h-2.5" /> Verified
                          </span>
                        </h4>
                        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mt-0.5 block">
                          {rev.city} • {rev.date}
                        </span>
                      </div>

                      {/* Star row */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs leading-relaxed font-sans">
                      {rev.review}
                    </p>
                  </div>
                </AnimeHover3D>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReviewsSection;

