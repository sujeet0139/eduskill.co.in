"use client";

import React, { useState, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { api } from "@/lib/api";

export function HeroCarousel() {
  const [slides, setSlides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [emblaRef] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000 }),
  ]);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const res = await api.get("/api/public/hero-slides");
        setSlides(res.slides);
      } catch (error) {
        console.error("Failed to fetch hero slides:", error);
        // Optionally set fallback slides
      } finally {
        setIsLoading(false);
      }
    };
    fetchSlides();
  }, []);

  if (isLoading) {
    return <div className="aspect-[5/3.5] bg-gray-800 rounded-2xl animate-pulse"></div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl shadow-2xl" ref={emblaRef}>
      <div className="flex">
        {slides.map((slide, index) => (
          <div className="relative flex-[0_0_100%] aspect-[5/3.5]" key={index}>
            <Image
              src={slide.image_url}
              alt={slide.alt_text || "Hero image"}
              fill
              style={{ objectFit: "cover" }}
              priority={index === 0} // Prioritize loading the first image
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}