import { Review } from "../types";

const REVIEWS_STORAGE_KEY = "babay_dee_customer_reviews";

export function loadStoredReviews(): Review[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error("Failed to read customer reviews from localStorage:", error);
    return [];
  }
}

export function saveStoredReviews(reviews: Review[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch (error) {
    console.error("Failed to save customer reviews to localStorage:", error);
  }
}

export function mergeStoredWithApiReviews(apiReviews: Review[], storedReviews: Review[]) {
  const existingIds = new Set(storedReviews.map((review) => review.id));
  return [...storedReviews, ...apiReviews.filter((review) => !existingIds.has(review.id))];
}
