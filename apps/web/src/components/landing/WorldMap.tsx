'use client';

import { useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string };
    end: { lat: number; lng: number; label?: string };
  }>;
}

export function WorldMap({ dots = [] }: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midX = (start.x + end.x) / 2;
    const distance = Math.abs(end.x - start.x);
    const midY = Math.min(start.y, end.y) - Math.min(80, distance * 0.3);
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  // Pre-computed world map dots for realistic continents
  const mapDots = useMemo(() => {
    // World map dot coordinates (pre-computed for realistic shapes)
    const continentPoints = [
      // North America
      ...generateContinentDots(-170, -50, 25, 70, [
        [-168, 65], [-150, 70], [-130, 55], [-125, 48], [-124, 38], [-117, 32],
        [-110, 32], [-105, 30], [-100, 28], [-97, 26], [-95, 30], [-88, 30],
        [-82, 25], [-80, 26], [-75, 35], [-70, 42], [-67, 45], [-60, 47],
        [-55, 50], [-57, 55], [-65, 60], [-75, 62], [-90, 65], [-110, 68],
        [-130, 70], [-150, 68], [-160, 62], [-165, 58], [-168, 65]
      ]),
      // South America
      ...generateContinentDots(-85, -30, -55, 12, [
        [-80, 10], [-75, 12], [-70, 10], [-60, 5], [-50, 0], [-45, -3],
        [-40, -8], [-38, -15], [-42, -23], [-52, -30], [-58, -38], [-65, -48],
        [-70, -55], [-75, -52], [-75, -42], [-72, -30], [-70, -18], [-77, -8],
        [-80, 0], [-80, 10]
      ]),
      // Europe
      ...generateContinentDots(-10, 40, 36, 72, [
        [-10, 36], [-5, 40], [0, 43], [5, 43], [10, 45], [12, 48], [8, 54],
        [12, 56], [20, 58], [28, 60], [30, 65], [25, 70], [15, 70], [5, 62],
        [-5, 58], [-8, 52], [-10, 45], [-10, 36]
      ]),
      // Africa
      ...generateContinentDots(-18, 52, -35, 38, [
        [-17, 20], [-12, 30], [-5, 36], [10, 37], [15, 32], [25, 32], [32, 30],
        [38, 20], [45, 12], [51, 12], [50, 0], [42, -5], [38, -15], [32, -25],
        [25, -34], [18, -35], [14, -28], [10, -15], [12, -5], [5, 5], [-5, 5],
        [-15, 12], [-17, 20]
      ]),
      // Asia
      ...generateContinentDots(25, 150, 5, 78, [
        [26, 42], [35, 42], [45, 40], [55, 45], [70, 45], [80, 38], [90, 25],
        [95, 15], [100, 10], [105, 15], [110, 22], [118, 25], [125, 35],
        [135, 35], [140, 45], [145, 50], [150, 55], [155, 60], [170, 68],
        [180, 70], [180, 78], [120, 78], [80, 75], [60, 72], [50, 65],
        [40, 55], [30, 45], [26, 42]
      ]),
      // Australia
      ...generateContinentDots(112, 155, -45, -10, [
        [114, -22], [120, -18], [130, -12], [140, -12], [148, -18], [152, -28],
        [150, -36], [145, -40], [138, -38], [128, -35], [118, -35], [114, -28],
        [114, -22]
      ]),
    ];

    return continentPoints;
  }, []);

  return (
    <div className="w-full aspect-[2/1] bg-gradient-to-b from-slate-50 to-white rounded-lg relative font-sans overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="w-full h-full"
      >
        {/* Background dots forming world map */}
        {mapDots}

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="line-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="line-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>
          <radialGradient id="point-gradient">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines with gradient and traveling dot */}
        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          const pathD = createCurvedPath(startPoint, endPoint);

          return (
            <g key={`path-group-${i}`}>
              {/* Base path (faint) */}
              <path
                d={pathD}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1"
                strokeOpacity="0.2"
              />

              {/* Animated path */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={`url(#line-gradient-${(i % 2) + 1})`}
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 2,
                  delay: 0.5 * i,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              />

              {/* Traveling dot using animateMotion */}
              <circle r="4" fill="#3b82f6" filter="url(#glow)">
                <animateMotion
                  dur="2s"
                  begin={`${0.5 * i}s`}
                  repeatCount="indefinite"
                  path={pathD}
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1"
                  keyTimes="0;1"
                />
              </circle>
            </g>
          );
        })}

        {/* Connection points */}
        {dots.map((dot, i) => (
          <g key={`points-group-${i}`}>
            {/* Start point */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 * i, duration: 0.3 }}
            >
              <circle
                cx={projectPoint(dot.start.lat, dot.start.lng).x}
                cy={projectPoint(dot.start.lat, dot.start.lng).y}
                r="6"
                fill="url(#point-gradient)"
              />
              <circle
                cx={projectPoint(dot.start.lat, dot.start.lng).x}
                cy={projectPoint(dot.start.lat, dot.start.lng).y}
                r="6"
                fill="#3b82f6"
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  from="6"
                  to="18"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.4"
                  to="0"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
            </motion.g>

            {/* End point */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 * i + 0.3, duration: 0.3 }}
            >
              <circle
                cx={projectPoint(dot.end.lat, dot.end.lng).x}
                cy={projectPoint(dot.end.lat, dot.end.lng).y}
                r="6"
                fill="url(#point-gradient)"
              />
              <circle
                cx={projectPoint(dot.end.lat, dot.end.lng).x}
                cy={projectPoint(dot.end.lat, dot.end.lng).y}
                r="6"
                fill="#22d3ee"
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  from="6"
                  to="18"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.4"
                  to="0"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
            </motion.g>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Helper function to generate dots within continent boundaries
function generateContinentDots(
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
  boundary: number[][]
): JSX.Element[] {
  const dots: JSX.Element[] = [];
  const step = 3;

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const isInsidePolygon = (lng: number, lat: number): boolean => {
    let inside = false;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const xi = boundary[i][0], yi = boundary[i][1];
      const xj = boundary[j][0], yj = boundary[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      if (isInsidePolygon(lng, lat)) {
        const point = projectPoint(lat, lng);
        dots.push(
          <circle
            key={`dot-${lat}-${lng}`}
            cx={point.x}
            cy={point.y}
            r="1.2"
            fill="#cbd5e1"
            opacity="0.6"
          />
        );
      }
    }
  }

  return dots;
}

export function GlobalMarketsSection() {
  const connections = [
    // San Francisco to New York
    {
      start: { lat: 37.7749, lng: -122.4194, label: 'San Francisco' },
      end: { lat: 40.7128, lng: -74.0060, label: 'New York' },
    },
    // Miami to London
    {
      start: { lat: 25.7617, lng: -80.1918, label: 'Miami' },
      end: { lat: 51.5074, lng: -0.1278, label: 'London' },
    },
    // Zurich to Dubai
    {
      start: { lat: 47.3769, lng: 8.5417, label: 'Zurich' },
      end: { lat: 25.2048, lng: 55.2708, label: 'Dubai' },
    },
    // Dubai to Hong Kong
    {
      start: { lat: 25.2048, lng: 55.2708, label: 'Dubai' },
      end: { lat: 22.3193, lng: 114.1694, label: 'Hong Kong' },
    },
    // New York to Paris
    {
      start: { lat: 40.7128, lng: -74.0060, label: 'New York' },
      end: { lat: 48.8566, lng: 2.3522, label: 'Paris' },
    },
    // Beijing to Hong Kong
    {
      start: { lat: 39.9042, lng: 116.4074, label: 'Beijing' },
      end: { lat: 22.3193, lng: 114.1694, label: 'Hong Kong' },
    },
  ];

  return (
    <section id="markets" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Global Markets, One Platform
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Trade across major watch markets worldwide. Connect with dealers in
            the US, Europe, UAE, and Hong Kong.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <WorldMap dots={connections} />
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-12">
          {[
            { flag: '🇺🇸', name: 'United States', deals: '2,500+' },
            { flag: '🇬🇧', name: 'United Kingdom', deals: '1,400+' },
            { flag: '🇨🇭', name: 'Switzerland', deals: '1,100+' },
            { flag: '🇦🇪', name: 'UAE', deals: '950+' },
            { flag: '🇨🇳', name: 'China', deals: '1,600+' },
            { flag: '🇭🇰', name: 'Hong Kong', deals: '1,200+' },
          ].map((market) => (
            <div
              key={market.name}
              className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-4xl mb-3 block">{market.flag}</span>
              <h3 className="font-semibold text-gray-900">{market.name}</h3>
              <p className="text-sm text-gray-500">{market.deals} active listings</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
