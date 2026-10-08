"use client";

import React, { useState, useEffect } from "react";

interface BrandLogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export default function BrandLogo({ className = "", showSubtitle = true }: BrandLogoProps) {
  const [isBouncing, setIsBouncing] = useState(false);

  const triggerBounce = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // Safe fallback
      }
    }
    setIsBouncing(false);
    requestAnimationFrame(() => {
      setIsBouncing(true);
    });
  };

  useEffect(() => {
    const handleCustomBounce = () => {
      triggerBounce();
    };
    window.addEventListener("thelife-logo-bounce", handleCustomBounce);
    return () => {
      window.removeEventListener("thelife-logo-bounce", handleCustomBounce);
    };
  }, []);

  return (
    <div 
      onClick={triggerBounce}
      onMouseEnter={triggerBounce}
      className={`flex items-center gap-3 select-none cursor-pointer group ${className}`}
      title="The Life Project OS — Click to bounce!"
    >
      {/* Dynamic Animated Gradient Shell with Multi-axis Organic Drift */}
      <div className="relative">
        {/* Dynamic Ambient Aura Glow */}
        <div className="absolute -inset-1.5 dynamic-gradient-badge rounded-2xl blur-md opacity-60 group-hover:opacity-90 transition-opacity" />
        
        {/* Fluid Shifting Gradient Chassis */}
        <div 
          onAnimationEnd={() => setIsBouncing(false)}
          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] p-[2px] shadow-sm transform-gpu dynamic-gradient-badge ${
            isBouncing ? "animate-duolingo-bounce" : "animate-emblem-organic"
          }`}
        >
          {/* Inner Translucent Glass Bezel */}
          <div className="w-full h-full rounded-[12px] bg-white/15 backdrop-blur-[2px] flex items-center justify-center overflow-hidden border border-white/40 shadow-inner">
            {/* The Living Clover Vault (Four-Leaf Fortune & Compounding Bloom) */}
            <svg 
              viewBox="0 0 32 32" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 transform group-hover:scale-110 transition-transform duration-150 drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]"
            >
              {/* Top Petal */}
              <path 
                d="M16 4.5C18.2 4.5 20.2 6.5 20.2 9C20.2 12.2 16 15 16 15C16 15 11.8 12.2 11.8 9C11.8 6.5 13.8 4.5 16 4.5Z" 
                fill="#FFFFFF" 
                fillOpacity="0.95"
              />
              {/* Bottom Petal */}
              <path 
                d="M16 27.5C13.8 27.5 11.8 25.5 11.8 23C11.8 19.8 16 17 16 17C16 17 20.2 19.8 20.2 23C20.2 25.5 18.2 27.5 16 27.5Z" 
                fill="#FFFFFF" 
                fillOpacity="0.95"
              />
              {/* Left Petal */}
              <path 
                d="M4.5 16C4.5 13.8 6.5 11.8 9 11.8C12.2 11.8 15 16 15 16C15 16 12.2 20.2 9 20.2C6.5 20.2 4.5 18.2 4.5 16Z" 
                fill="#FFFFFF" 
                fillOpacity="0.88"
              />
              {/* Right Petal */}
              <path 
                d="M27.5 16C27.5 18.2 25.5 20.2 23 20.2C19.8 20.2 17 16 17 16C17 16 19.8 11.8 23 11.8C25.5 11.8 27.5 13.8 27.5 16Z" 
                fill="#FFFFFF" 
                fillOpacity="0.88"
              />

              {/* Central Interlocking Aperture Ring */}
              <circle 
                cx="16" 
                cy="16" 
                r="4" 
                stroke="#FFFFFF" 
                strokeWidth="1.5" 
                fill="#FFFFFF" 
                fillOpacity="0.35"
              />

              {/* Center Diamond Star Core */}
              <path 
                d="M16 13.5L17.5 16L16 18.5L14.5 16Z" 
                fill="#FFFFFF" 
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Typography Block */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900 leading-tight group-hover:text-amber-600 transition-colors">
            The Life Project
          </h1>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-stone-100 border border-stone-200/80 text-[10px] font-bold text-stone-600 tracking-wider uppercase">
            OS
          </span>
        </div>
        {showSubtitle && (
          <p className="hidden sm:block text-[11px] font-medium text-stone-500 leading-none mt-0.5">
            Personal Finance Operating System
          </p>
        )}
      </div>
    </div>
  );
}
