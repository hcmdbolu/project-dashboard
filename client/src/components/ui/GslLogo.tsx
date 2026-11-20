import React from 'react';

interface GslLogoProps {
  className?: string;
}

export const GslLogo: React.FC<GslLogoProps> = ({ className = 'h-10 w-10' }) => (
  <img
    src="/gsl-logo.png"
    alt="Greensprings School Crest"
    className={`object-contain ${className}`}
  />
);
