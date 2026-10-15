'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  /** Numeric target value to animate to */
  value: number;
  /** Optional starting numeric value to animate from */
  fromValue?: number;
  /** Duration of rolling animation in seconds (default: 2.1s, slightly faster than 2.8s tactile highlight) */
  duration?: number;
  /** Prepend text or currency symbol (e.g. "Rp ") */
  prefix?: string;
  /** Append text (e.g. "%") */
  suffix?: string;
  /** Custom class name */
  className?: string;
}

const formatIDR = (val: number): string => {
  const safeVal = Math.round(Number.isFinite(val) ? val : 0);
  const abs = Math.abs(safeVal);
  const formattedInt = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = safeVal < 0 ? '-' : '';
  return `${sign}${formattedInt}`;
};

// Single Digit Rolling Column
const DigitColumn: React.FC<{
  digit: string;
  fromDigit?: string;
  duration?: number;
}> = ({ digit, fromDigit, duration = 2.1 }) => {
  const isNumber = !isNaN(parseInt(digit, 10));
  const numValue = isNumber ? parseInt(digit, 10) : 0;

  const initialDigit =
    fromDigit !== undefined && !isNaN(parseInt(fromDigit, 10))
      ? parseInt(fromDigit, 10)
      : undefined;

  if (!isNumber) {
    return (
      <span className="inline-block px-[0.5px] select-none font-mono-numbers">
        {digit}
      </span>
    );
  }

  const shouldAnimateOnMount = initialDigit !== undefined && initialDigit !== numValue;

  return (
    <span className="inline-block relative overflow-hidden h-[1.15em] leading-[1.15em] w-[0.62em] text-center select-none font-mono-numbers align-baseline">
      <motion.span
        initial={shouldAnimateOnMount ? { y: `-${initialDigit * 10}%` } : false}
        animate={{ y: `-${numValue * 10}%` }}
        transition={{
          duration,
          ease: [0.16, 1, 0.3, 1], // Smooth Apple-grade physical deceleration
        }}
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
  fromValue,
  duration = 2.1,
  prefix = '',
  suffix = '',
  className,
}) => {
  const targetFormatted = formatIDR(value);
  const targetChars = targetFormatted.split('');

  // If fromValue is provided and differs from value, compute starting digit for each column
  const hasFrom = fromValue !== undefined && fromValue !== value;
  const fromFormatted = hasFrom ? formatIDR(fromValue) : undefined;
  const fromChars = fromFormatted ? fromFormatted.split('') : null;

  return (
    <span
      className={cn(
        'inline-flex items-baseline font-mono-numbers tracking-tight select-none',
        className
      )}
      aria-label={`${prefix}${targetFormatted}${suffix}`}
    >
      {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
      <span className="inline-flex items-baseline overflow-hidden">
        {targetChars.map((char, index) => {
          const colFromRight = targetChars.length - 1 - index;
          const keyType = char === '.' ? 'dot' : char === '-' ? 'minus' : 'd';

          let fromDigit: string | undefined = undefined;
          if (fromChars && char >= '0' && char <= '9') {
            const fromIndex = fromChars.length - 1 - colFromRight;
            if (fromIndex >= 0 && fromChars[fromIndex] >= '0' && fromChars[fromIndex] <= '9') {
              fromDigit = fromChars[fromIndex];
            } else {
              fromDigit = '0';
            }
          }

          return (
            <DigitColumn
              key={`col-${colFromRight}-${keyType}`}
              digit={char}
              fromDigit={fromDigit}
              duration={duration}
            />
          );
        })}
      </span>
      {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
    </span>
  );
};

export default AnimatedNumber;
