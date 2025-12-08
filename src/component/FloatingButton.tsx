'use client';

import Image from "next/image";

interface FloatingButtonProps {
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export default function FloatingButton({
  className = "",
  onClick,
  ariaLabel = "Floating action",
}: FloatingButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`h-[60px] w-[60px] overflow-hidden rounded-full border border-[#7553FC] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-transform hover:scale-105 active:scale-95 z-[60] ${className}`}
    >
      <Image
        src="/boradori.png"
        alt="Floating action"
        width={50}
        height={50}
        className="object-cover mx-auto"
        priority
      />
    </button>
  );
}
