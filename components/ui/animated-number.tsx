'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  /** Numeric target value to animate to */
  value: number;
  /** Optional starting numeric value to animate from */
  fromValue?: number;
  /** Duration of rolling animation in seconds (default: 2.5s / 2500ms) */
  duration?: number;
  /** Delay in seconds before rolling animation starts (default: 0.71s / 710ms) */
  delay?: number;
  /** Prepend text or currency symbol (e.g. "Rp ") */
  prefix?: string;
  /** Append text (e.g. "%") */
  suffix?: string;
  /** Custom class name */
  className?: string;
  /** When true, masks the numeric value with bullets (Rp ••••••) */
  hideNominals?: boolean;
}

export const formatIDR = (val: number): string => {
  const safeVal = Math.round(Number.isFinite(val) ? val : 0);
  const abs = Math.abs(safeVal);
  const formattedInt = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = safeVal < 0 ? '-' : '';
  return `${sign}${formattedInt}`;
};

/**
 * Extracts the single digit at place value 10^col (0 for units, 1 for tens, etc.)
 */
export const getDigitAtCol = (val: number, col: number): number => {
  const abs = Math.abs(Math.round(Number.isFinite(val) ? val : 0));
  return Math.floor(abs / Math.pow(10, col)) % 10;
};

/**
 * Builds the sequence of digits for the mechanical rolling reel
 */
export const buildReelDigits = (
  fromDigit: number,
  targetDigit: number,
  revolutions: number,
  isIncreasing: boolean
): number[] => {
  const deltaSteps = isIncreasing
    ? (targetDigit - fromDigit + 10) % 10
    : (fromDigit - targetDigit + 10) % 10;

  const totalSteps = revolutions * 10 + deltaSteps;

  if (totalSteps === 0) {
    return [targetDigit];
  }

  const digits: number[] = [fromDigit];
  let current = fromDigit;

  for (let step = 1; step <= totalSteps; step++) {
    if (isIncreasing) {
      current = (current + 1) % 10;
    } else {
      current = (current - 1 + 10) % 10;
    }
    digits.push(current);
  }

  return digits;
};

/**
 * Calculates cascading delay and duration for a given column from the right
 */
export const calculateColumnTiming = (
  colFromRight: number,
  baseDuration = 2.5,
  baseDelay = 0.71,
  staggerStep = 0.05
): { columnDelay: number; columnDuration: number } => {
  const columnDelay = baseDelay + colFromRight * staggerStep;
  const columnDuration = Math.max(0.8, baseDuration - colFromRight * staggerStep);
  return { columnDelay, columnDuration };
};

/**
 * Calculates highest changed place value (0 for units, 1 for tens, etc.)
 */
export const calculateMaxChangedCol = (
  value: number,
  fromValue?: number
): number => {
  if (fromValue === undefined || fromValue === value) return -1;
  const delta = Math.abs(value - fromValue);
  let maxChangedCol = delta > 0 ? Math.floor(Math.log10(delta)) : 0;

  const maxNum = Math.max(Math.abs(value), Math.abs(fromValue));
  const maxPlaces = maxNum > 0 ? Math.floor(Math.log10(maxNum)) + 1 : 1;

  for (let c = maxPlaces; c >= 0; c--) {
    if (getDigitAtCol(value, c) !== getDigitAtCol(fromValue, c)) {
      if (c > maxChangedCol) {
        maxChangedCol = c;
      }
      break;
    }
  }
  return maxChangedCol;
};

/**
 * Determines mechanical gear ratio revolutions for a given column
 */
export const calculateRevolutions = (
  colFromRight: number,
  maxChangedCol: number,
  hasChange: boolean
): number => {
  if (!hasChange || colFromRight > maxChangedCol) {
    return 0;
  }
  if (colFromRight === 0) {
    return 2; // Units wheel spins 2 full revolutions + delta
  }
  if (colFromRight === 1 || colFromRight === 2) {
    return 1; // Tens & hundreds spin 1 full revolution + delta
  }
  return 0; // Higher digits (colFromRight >= 3) take direct step (0 revolutions)
};

interface DigitColumnProps {
  char: string;
  isDigit: boolean;
  colFromRight: number;
  reelDigits: number[];
  duration: number;
  delay: number;
}

const DigitColumn: React.FC<DigitColumnProps> = React.memo(
  ({ char, isDigit, reelDigits, duration, delay }) => {
    if (!isDigit) {
      return (
        <span className="inline-block px-[0.5px] select-none font-mono-numbers">
          {char}
        </span>
      );
    }

    if (reelDigits.length <= 1) {
      return (
        <span className="inline-block relative overflow-hidden h-[1.15em] leading-[1.15em] w-[0.62em] text-center select-none font-mono-numbers align-baseline">
          <span className="h-[1.15em] leading-[1.15em] flex items-center justify-center">
            {char}
          </span>
        </span>
      );
    }

    const targetTranslateY = `-${((reelDigits.length - 1) / reelDigits.length) * 100}%`;

    return (
      <span className="inline-block relative overflow-hidden h-[1.15em] leading-[1.15em] w-[0.62em] text-center select-none font-mono-numbers align-baseline">
        <motion.span
          initial={{ y: '0%' }}
          animate={{ y: ['0%', targetTranslateY] }}
          transition={{
            duration,
            delay,
            ease: [0.16, 1, 0.3, 1], // Smooth Apple-grade physical deceleration
          }}
          className="flex flex-col select-none"
        >
          {reelDigits.map((d, idx) => (
            <span
              key={idx}
              className="h-[1.15em] leading-[1.15em] flex items-center justify-center shrink-0"
            >
              {d}
            </span>
          ))}
        </motion.span>
      </span>
    );
  }
);

DigitColumn.displayName = 'DigitColumn';

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  fromValue,
  duration = 2.5,
  delay = 0.71,
  prefix = '',
  suffix = '',
  className,
  hideNominals = false,
}) => {
  if (hideNominals) {
    return (
      <span
        className={cn(
          'inline-flex items-baseline font-mono-numbers tracking-tight select-none',
          className
        )}
        aria-label={`${prefix}••••••${suffix}`}
      >
        {prefix && <span className="mr-0.5 select-none">{prefix}</span>}
        <span className="inline-block tracking-wider font-mono">••••••</span>
        {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
      </span>
    );
  }

  const targetFormatted = formatIDR(value);
  const targetChars = targetFormatted.split('');

  const hasChange = fromValue !== undefined && fromValue !== value;
  const isIncreasing = value >= (fromValue ?? value);

  // Compute colFromRight (0 for units, 1 for tens, etc., skipping punctuation)
  const colFromRightMap: number[] = new Array(targetChars.length).fill(-1);
  let digitCounter = 0;
  for (let i = targetChars.length - 1; i >= 0; i--) {
    const c = targetChars[i];
    if (c >= '0' && c <= '9') {
      colFromRightMap[i] = digitCounter;
      digitCounter++;
    }
  }

  // Determine highest changed place value (maxChangedCol)
  const maxChangedCol = calculateMaxChangedCol(value, fromValue);
  const staggerStep = 0.05; // 50ms stagger step for units-first cascade

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
          const colFromRight = colFromRightMap[index];
          const isDigit = colFromRight >= 0;

          if (!isDigit) {
            return (
              <DigitColumn
                key={`punct-${index}-${char}`}
                char={char}
                isDigit={false}
                colFromRight={-1}
                reelDigits={[]}
                duration={0}
                delay={0}
              />
            );
          }

          const targetDigit = parseInt(char, 10);
          const fromDigit = hasChange
            ? getDigitAtCol(fromValue!, colFromRight)
            : targetDigit;

          // Gear Ratio Revolutions
          const revolutions = calculateRevolutions(colFromRight, maxChangedCol, hasChange);

          const reelDigits = hasChange
            ? buildReelDigits(fromDigit, targetDigit, revolutions, isIncreasing)
            : [targetDigit];

          // Units-first cascade timing
          const { columnDelay, columnDuration } = calculateColumnTiming(
            colFromRight,
            duration,
            delay,
            staggerStep
          );

          return (
            <DigitColumn
              key={`col-${colFromRight}-${targetDigit}-${fromDigit}-${reelDigits.length}`}
              char={char}
              isDigit={true}
              colFromRight={colFromRight}
              reelDigits={reelDigits}
              duration={columnDuration}
              delay={columnDelay}
            />
          );
        })}
      </span>
      {suffix && <span className="ml-0.5 select-none">{suffix}</span>}
    </span>
  );
};

export default AnimatedNumber;
