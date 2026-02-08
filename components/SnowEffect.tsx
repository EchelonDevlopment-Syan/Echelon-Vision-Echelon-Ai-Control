/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo } from 'react';

const SnowEffect: React.FC = () => {
  const snowflakes = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + '%',
      animationDuration: Math.random() * 5 + 5 + 's', // 5-10s duration
      animationDelay: -(Math.random() * 10) + 's', // Start immediately at random offsets
      opacity: Math.random() * 0.4 + 0.2,
      size: Math.random() * 0.4 + 0.3 + 'rem', 
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" aria-hidden="true">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute rounded-full bg-slate-300 dark:bg-white/60 blur-[1px]"
          style={{
            left: flake.left,
            top: '-20px',
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            animation: `snowfall ${flake.animationDuration} linear infinite`,
            animationDelay: flake.animationDelay,
          }}
        />
      ))}
    </div>
  );
};

export default SnowEffect;