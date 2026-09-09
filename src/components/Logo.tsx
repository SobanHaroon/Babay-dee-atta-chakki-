import React from "react";

const publicLogo = "/logo%20coloured.jpg";

interface LogoProps {
  className?: string;
  imgClassName?: string;
  showText?: boolean;
}

export function Logo({ className = "w-12 h-12", imgClassName = "object-contain", showText = false }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={publicLogo}
        alt="Babay Dee Atta Chakki Logo"
        width="144"
        height="108"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-center bg-white app-brand-logo ${imgClassName}`}
        loading="eager"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = publicLogo;
        }}
      />
    </div>
  );
}

