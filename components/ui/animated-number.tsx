'use client';

import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  /** Numeric value to animate to */
  value: number;
  /** Prepend text or currency symbol (e.g. "Rp ") */
  prefix?: string;
  /** Append text (e.g. "%") */
  suffix?: string;
  /** Spring physics stiffness (default: 170) */
  stiffness?: number;
  /** Spring physics damping (default: 22) */
  damping?: number;
  /** Mass of spring (default: 0.6) */
  mass?: number;
  /** Custom class name */
  className?: string;
}

// Single Digit Rolling Column
const DigitColumn: React.FC<{
  digit: string;
  stiffness?: number;
  damping?: number;
  mass?: number;
}> = ({ digit, stiffness = 170, damping = 22, mass = 0.6 }) => {
  const isNumber = !isNaN(parseInt(digit, 10));
  const numValue = isNumber ? parseInt(digit, 10) : 0;

  const spring = useSpring(numValue, {
    stiffness,
    damping,
    mass,
  });

  const y = useTransform(spring, (current) => `-${current * 10}%`);

  useEffect(() => {
    spring.set(numValue);
  }, [spring, numValue]);

  if (!isNumber) {
    return (
      <span className="inline-block px-[1px] select-none font-mono-numbers">
        {digit}
      </span>
    );
  }

  return (
    <span className="inline-block relative overflow-hidden h-[1.15em] leading-[1.15em] w-[0.62em] text-center select-none font-mono-numbers align-baseline">
      <motion.span
        style={{ y }}
        className="flex flex-col select-none"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="h-[1.15em] flex items-center justify-center">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefix = '',
  suffix = '',
  stiffness = 170,
  damping = 22,
  mass = 0.6,
  className,
}) => {
  // Format as Indonesian Rupiah with dot (.) thousand separators
  const safeVal = Math.round(Number.isFinite(value) ? value : 0);
  const abs = Math.abs(safeVal);
  const formattedInt = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = safeVal < 0 ? '-' : '';
  const formattedStr = `${sign}${formattedInt}`;
  const chars = formattedStr.split('');

  return (
    <span
      className={cn(
        'inline-flex items-baseline font-mono-numbers tracking-tight select-none',
        className
      )}
      aria-label={`${prefix}${formattedStr}${suffix}`}
    >
      {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
      <span className="inline-flex items-baseline overflow-hidden">
        {chars.map((char, index) => {
          // Align columns from the right for stable digit transitions
          const colFromRight = chars.length - 1 - index;
          const keyType = char === '.' ? 'dot' : char === '-' ? 'minus' : 'd';
          return (
            <DigitColumn
              key={`${colFromRight}-${keyType}`}
              digit={char}
              stiffness={stiffness}
              damping={damping}
              mass={mass}
            />
          );
        })}
      </span>
      {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
    </span>
  );
};

export default AnimatedNumber;
