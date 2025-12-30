"use client";

import { useMemo } from "react";

interface GridNode {
  id: number;
  x: number;
  y: number;
  delay: number;
}

// Pre-generated nodes to avoid hydration mismatch
const STATIC_NODES: GridNode[] = [
  { id: 0, x: 15, y: 12, delay: 0 },
  { id: 1, x: 82, y: 8, delay: 1 },
  { id: 2, x: 45, y: 25, delay: 2 },
  { id: 3, x: 72, y: 35, delay: 3 },
  { id: 4, x: 28, y: 48, delay: 4 },
  { id: 5, x: 88, y: 55, delay: 5 },
  { id: 6, x: 12, y: 68, delay: 6 },
  { id: 7, x: 55, y: 72, delay: 7 },
  { id: 8, x: 38, y: 85, delay: 0.5 },
  { id: 9, x: 78, y: 88, delay: 1.5 },
  { id: 10, x: 22, y: 92, delay: 2.5 },
  { id: 11, x: 65, y: 18, delay: 3.5 },
];

export function AuthGridBackground() {
  const nodes = useMemo(() => STATIC_NODES, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />

      {/* Corner accent markers - Top Left */}
      <div className="absolute top-8 left-8">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-8 h-[1px] bg-gradient-to-r from-primary/60 to-transparent" />
          <div className="absolute top-0 left-0 w-[1px] h-8 bg-gradient-to-b from-primary/60 to-transparent" />
          <div className="absolute top-0 left-0 w-1 h-1 bg-primary/80 auth-pulse-node" />
        </div>
      </div>

      {/* Corner accent markers - Top Right */}
      <div className="absolute top-8 right-8">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 right-0 w-8 h-[1px] bg-gradient-to-l from-primary/60 to-transparent" />
          <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-b from-primary/60 to-transparent" />
          <div className="absolute top-0 right-0 w-1 h-1 bg-primary/80 auth-pulse-node" style={{ animationDelay: "1s" }} />
        </div>
      </div>

      {/* Corner accent markers - Bottom Left */}
      <div className="absolute bottom-8 left-8">
        <div className="relative w-16 h-16">
          <div className="absolute bottom-0 left-0 w-8 h-[1px] bg-gradient-to-r from-primary/60 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[1px] h-8 bg-gradient-to-t from-primary/60 to-transparent" />
          <div className="absolute bottom-0 left-0 w-1 h-1 bg-primary/80 auth-pulse-node" style={{ animationDelay: "2s" }} />
        </div>
      </div>

      {/* Corner accent markers - Bottom Right */}
      <div className="absolute bottom-8 right-8">
        <div className="relative w-16 h-16">
          <div className="absolute bottom-0 right-0 w-8 h-[1px] bg-gradient-to-l from-primary/60 to-transparent" />
          <div className="absolute bottom-0 right-0 w-[1px] h-8 bg-gradient-to-t from-primary/60 to-transparent" />
          <div className="absolute bottom-0 right-0 w-1 h-1 bg-primary/80 auth-pulse-node" style={{ animationDelay: "3s" }} />
        </div>
      </div>

      {/* Grid intersection glow nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute w-1 h-1 auth-grid-node"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            animationDelay: `${node.delay}s`,
          }}
        >
          <div className="absolute inset-0 bg-primary/60 rounded-full" />
          <div className="absolute -inset-2 bg-primary/20 rounded-full blur-sm auth-pulse-glow" style={{ animationDelay: `${node.delay}s` }} />
        </div>
      ))}

      {/* Center focus glow - subtle vignette effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/80" />

      {/* Subtle primary accent glow behind card area */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-3xl" />

      {/* Data flow lines - horizontal (multiple) */}
      <div className="absolute top-[10%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-24 bg-gradient-to-r from-transparent via-primary/25 to-transparent auth-data-flow-h" />
      </div>
      <div className="absolute top-[25%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-32 bg-gradient-to-r from-transparent via-primary/20 to-transparent auth-data-flow-h" style={{ animationDelay: "2s" }} />
      </div>
      <div className="absolute top-[40%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-20 bg-gradient-to-r from-transparent via-primary/15 to-transparent auth-data-flow-h" style={{ animationDelay: "5s" }} />
      </div>
      <div className="absolute top-[60%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-28 bg-gradient-to-r from-transparent via-primary/20 to-transparent auth-data-flow-h" style={{ animationDelay: "3.5s" }} />
      </div>
      <div className="absolute top-[75%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-32 bg-gradient-to-r from-transparent via-primary/25 to-transparent auth-data-flow-h" style={{ animationDelay: "7s" }} />
      </div>
      <div className="absolute top-[90%] left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-20 bg-gradient-to-r from-transparent via-primary/15 to-transparent auth-data-flow-h" style={{ animationDelay: "1s" }} />
      </div>

      {/* Data flow lines - vertical (multiple) */}
      <div className="absolute left-[10%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-24 bg-gradient-to-b from-transparent via-primary/20 to-transparent auth-data-flow-v" style={{ animationDelay: "1.5s" }} />
      </div>
      <div className="absolute left-[25%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-32 bg-gradient-to-b from-transparent via-primary/25 to-transparent auth-data-flow-v" style={{ animationDelay: "4s" }} />
      </div>
      <div className="absolute left-[40%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-20 bg-gradient-to-b from-transparent via-primary/15 to-transparent auth-data-flow-v" style={{ animationDelay: "6.5s" }} />
      </div>
      <div className="absolute left-[60%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-28 bg-gradient-to-b from-transparent via-primary/20 to-transparent auth-data-flow-v" style={{ animationDelay: "2.5s" }} />
      </div>
      <div className="absolute left-[75%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-32 bg-gradient-to-b from-transparent via-primary/25 to-transparent auth-data-flow-v" style={{ animationDelay: "5.5s" }} />
      </div>
      <div className="absolute left-[90%] top-0 bottom-0 w-[1px] overflow-hidden">
        <div className="w-full h-20 bg-gradient-to-b from-transparent via-primary/15 to-transparent auth-data-flow-v" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* Extended corner style accents at screen edges */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-start">
        <div className="w-[1px] h-12 bg-gradient-to-b from-primary/30 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end">
        <div className="w-[1px] h-12 bg-gradient-to-t from-primary/30 to-transparent" />
      </div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
        <div className="h-[1px] w-12 bg-gradient-to-r from-primary/30 to-transparent" />
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
        <div className="h-[1px] w-12 bg-gradient-to-l from-primary/30 to-transparent" />
      </div>
    </div>
  );
}
