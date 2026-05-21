import React, { useEffect, useRef, useState } from "react";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

const CAROUSEL_SLIDES: { src: string; alt: string }[] = [
  { src: "/images/carousel/carousel1.webp", alt: "Hope Pro – Caregivers in action" },
  { src: "/images/carousel/carousel2.webp", alt: "Hope Pro – Patient care experience" },
  { src: "/images/carousel/carousel1.webp", alt: "Hope Pro – Trusted home care" },
];

const SLIDE_INTERVAL_MS = 2000;
const SLIDE_TRANSITION_MS = 700;

function AuthCarousel() {
  const N = CAROUSEL_SLIDES.length;
  // Track has N+1 items: the first slide is duplicated at the end so we can
  // always advance right-to-left, then silently snap back to position 0.
  const trackSlides = [...CAROUSEL_SLIDES, CAROUSEL_SLIDES[0]];
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const snapTimer = useRef<number | null>(null);

  useEffect(() => {
    if (N <= 1) return;
    const id = window.setInterval(() => {
      setAnimate(true);
      setIndex((prev) => prev + 1);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [N]);

  useEffect(() => {
    if (index !== N) return;
    snapTimer.current = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, SLIDE_TRANSITION_MS);
    return () => {
      if (snapTimer.current != null) window.clearTimeout(snapTimer.current);
    };
  }, [index, N]);

  useEffect(() => {
    if (animate) return;
    const raf = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(raf);
  }, [animate]);

  const activeDot = index % N;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hope Pro highlights"
    >
      <div
        className="flex h-full"
        style={{
          width: `${trackSlides.length * 100}%`,
          transform: `translateX(-${(index * 100) / trackSlides.length}%)`,
          transition: animate ? `transform ${SLIDE_TRANSITION_MS}ms ease-out` : "none",
        }}
      >
        {trackSlides.map((slide, i) => (
          <div
            key={i}
            className="h-full shrink-0"
            style={{ width: `${100 / trackSlides.length}%` }}
            aria-hidden={i !== index}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover"
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      <div
        className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-3"
        role="tablist"
        aria-label="Slide selector"
      >
        {CAROUSEL_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeDot}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => {
              setAnimate(true);
              setIndex(i);
            }}
            className={`size-2.5 rounded-full border-2 border-white transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
              i === activeDot
                ? "bg-brand-500 border-brand-500 scale-110"
                : "bg-transparent hover:bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-1 bg-white p-6 dark:bg-gray-900 sm:p-0">
      <div className="relative flex h-screen w-full flex-col justify-center dark:bg-gray-900 sm:p-0 lg:flex-row">
        {children}
        <div className="hidden h-full w-full bg-brand-950 dark:bg-white/5 lg:block lg:w-1/2">
          <AuthCarousel />
        </div>
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
