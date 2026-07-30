import React from "react";
// @ts-ignore
import logoImg from "../assets/logo.jpg";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "w-12 h-12", showText = false }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={logoImg || "/logo.jpg"}
        alt="Babay Dee Atta Chakki Logo"
        width="96"
        height="96"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain rounded-full bg-transparent"
        loading="eager"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/logo.jpg";
        }}
      />
    </div>
  );
}

