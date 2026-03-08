/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo } from 'react';

const SnowEffect: React.FC = () => {
  const snowflakes = useMemo(() => {
    return Array.from({ length: 70 }).map((_, i) => {
      const size = Math.random() * 0.4 + 0.1;
      const isSparkle = Math.random() > 0.8; // Some flakes are "crystalline"
      
      return {
        id: i,
        left: Math.random() * 100 + '%',
        animationDuration: Math.random() * 8 + 7 + 's', // 7-15s duration for natural feel
        animationDelay: -(Math.random() * 15) + 's',
        opacity: Math.random() * 0.5 + 0.2,
        size: size + 'rem',
        blur: size < 0.2 ? '1px' : '0px',
        color: isSparkle ? 'bg-cyan-200 dark:bg-cyan-100' : 'bg-slate-200 dark:bg-white/80',
        glow: isSparkle ? 'shadow-[0_0_8px_rgba(6,182,212,0.8)]' : ''
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" aria-hidden="true">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className={`absolute rounded-full ${flake.color} ${flake.glow} will-change-transform`}
          style={{
            left: flake.left,
            top: '-20px',
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: `blur(${flake.blur})`,
            animation: `snowfall-complex ${flake.animationDuration} linear infinite`,
            animationDelay: flake.animationDelay,
          }}
        />
      ))}
    </div>
  );
};

export default SnowEffect;