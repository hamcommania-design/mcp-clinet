"use client";

import { useEffect, useState } from "react";

interface Snowflake {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
}

interface SnowfallProps {
  count?: number;
}

export function Snowfall({ count = 50 }: SnowfallProps) {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    // 눈송이 생성
    const newSnowflakes: Snowflake[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100, // 0% ~ 100%
      size: 3 + Math.random() * 7, // 3px ~ 10px (크기 증가로 가시성 향상)
      duration: 5 + Math.random() * 10, // 5초 ~ 15초 (더 천천히)
      delay: Math.random() * 3, // 0초 ~ 3초
      sway: -20 + Math.random() * 40, // -20px ~ 20px
    }));

    setSnowflakes(newSnowflakes);
  }, [count]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[11] overflow-hidden"
      aria-hidden="true"
    >
      {snowflakes.map((snowflake) => (
        <div
          key={snowflake.id}
          className="absolute top-0 rounded-full bg-white will-change-transform"
          style={{
            left: `${snowflake.left}%`,
            width: `${snowflake.size}px`,
            height: `${snowflake.size}px`,
            animation: `snowfall ${snowflake.duration}s linear infinite`,
            animationDelay: `${snowflake.delay}s`,
            '--sway-distance': `${snowflake.sway}px`,
            boxShadow: `0 0 ${snowflake.size * 2}px rgba(255, 255, 255, 1)`,
            filter: 'blur(0.3px)',
            opacity: 1,
          } as React.CSSProperties & { '--sway-distance': string }}
        />
      ))}
    </div>
  );
}

