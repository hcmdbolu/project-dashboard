import React from 'react';

interface GslLogoProps {
  className?: string;
}

export const GslLogo: React.FC<GslLogoProps> = ({ className = 'h-10 w-10' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Greensprings School GSL Crest"
  >
    <rect width="48" height="48" rx="12" fill="#14532D" />
    <path
      d="M24 7L38 12.5V23.5C38 32.1 32 39.2 24 41.5C16 39.2 10 32.1 10 23.5V12.5L24 7Z"
      fill="#166534"
      stroke="#BBF7D0"
      strokeWidth="1.75"
    />
    <path
      d="M17.5 24.5C17.5 20.6 20.4 17.5 24.3 17.5C26.7 17.5 28.6 18.5 29.7 20.1L27.1 21.8C26.4 20.9 25.4 20.3 24.2 20.3C22.1 20.3 20.6 22.1 20.6 24.5C20.6 26.9 22.1 28.7 24.3 28.7C25.8 28.7 26.9 27.9 27.3 26.5H24.2V23.9H30.4V25.6C30.4 29.4 27.9 31.6 24.2 31.6C20.3 31.6 17.5 28.5 17.5 24.5Z"
      fill="#FFFFFF"
    />
  </svg>
);

