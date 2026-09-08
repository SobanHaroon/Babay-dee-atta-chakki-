import React from "react";

interface LogoProps {
  className?: string;
  imgClassName?: string;
  showText?: boolean;
}

export function Logo({ className = "w-16 h-12", imgClassName = "object-contain", showText = false }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/logo%20coloured.jpg"
        alt="Babay Dee Atta Chakki Logo"
        width="960"
        height="720"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full bg-transparent app-brand-logo ${imgClassName}`}
        loading="eager"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/logo%20coloured.jpg";
        }}
      />
    </div>
  );
}

