import React from "react";
// @ts-ignore
interface LogoProps {
  className?: string;
  imgClassName?: string;
  showText?: boolean;
}

export function Logo({ className = "w-12 h-12", imgClassName = "object-cover object-center", showText = false }: LogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 aspect-square overflow-hidden rounded-full bg-white/80 ${className}`}>
      <img
        src="/logo coloured.jpg"
        alt="Babay Dee Atta Chakki Logo"
        width="96"
        height="96"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full aspect-square object-cover object-center bg-transparent app-brand-logo ${imgClassName}`}
        loading="eager"
        style={{ objectFit: 'contain', objectPosition: 'center' }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/logo coloured.jpg";
        }}
      />
    </div>
  );
}

