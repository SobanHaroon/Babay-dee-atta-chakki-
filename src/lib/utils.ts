export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Triggers haptic vibration feedback for mobile users using navigator.vibrate API
 * @param pattern Vibration pattern in ms (number) or sequence of ms (number[])
 */
export function triggerHapticFeedback(pattern: number | number[] = 30) {
  if (typeof window !== "undefined" && "navigator" in window && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently catch if user interaction policy or device disables vibration
    }
  }
}

