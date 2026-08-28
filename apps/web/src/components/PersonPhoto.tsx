"use client";

import Image from "next/image";
import { useState } from "react";

interface PersonPhotoProps {
  src: string;
  alt: string;
  initials: string;
}

export function PersonPhoto({ src, alt, initials }: PersonPhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label={`Portrait indisponible — ${initials}`}
        className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-700"
      >
        {initials}
      </span>
    );
  }

  return <Image src={src} alt={alt} fill sizes="(max-width: 640px) 50vw, 190px" className="object-cover" onError={() => setFailed(true)} />;
}
