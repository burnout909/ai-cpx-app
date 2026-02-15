'use client';

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
      className={`h-[60px] w-[60px] flex items-center justify-center rounded-full bg-white border-2 border-[#9B85FC] transition-transform hover:scale-105 active:scale-95 z-[60] ${className}`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9B85FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
      </svg>
    </button>
  );
}
