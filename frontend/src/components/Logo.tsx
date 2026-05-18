import React from "react";

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M41 11C22.77 11 8 25.33 8 43C8 50.52 10.67 57.43 15.12 62.87L10.52 82.52L30.87 75.58C34.02 76.51 37.44 77 41 77C59.23 77 74 62.67 74 45"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="25" y1="42" x2="25" y2="53" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="35" y1="33" x2="35" y2="62" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="45" y1="25" x2="45" y2="70" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="55" y1="33" x2="55" y2="62" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="65" y1="42" x2="65" y2="53" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M68 12C56.95 12 48 20.95 48 32C48 35.2 48.76 38.23 50.09 40.91L47.42 52.58L59.09 49.91C61.77 51.24 64.8 52 68 52C79.05 52 88 43.05 88 32C88 20.95 79.05 12 68 12Z"
        fill="white"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="32" r="3.3" fill="currentColor" />
      <circle cx="68" cy="32" r="3.3" fill="currentColor" />
      <circle cx="76" cy="32" r="3.3" fill="currentColor" />
    </svg>
  );
}
