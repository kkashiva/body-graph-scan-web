'use client';

// Silhouette + alignment overlays. Rendered on top of the video feed with
// `pointer-events: none` so they don't block interactions. All three overlays
// use the same viewBox (100x177) — a 9:16 portrait frame — so the silhouettes
// sit inside the same gridlines regardless of device.

const VIEW_BOX = '0 0 100 177';

export function AlignmentGrid() {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* rule-of-thirds gridlines */}
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
        <line x1="33.33" y1="0" x2="33.33" y2="177" />
        <line x1="66.66" y1="0" x2="66.66" y2="177" />
        <line x1="0" y1="59" x2="100" y2="59" />
        <line x1="0" y1="118" x2="100" y2="118" />
      </g>
      {/* center crosshair */}
      <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.4" fill="none">
        <line x1="50" y1="84" x2="50" y2="93" />
        <line x1="45.5" y1="88.5" x2="54.5" y2="88.5" />
      </g>
    </svg>
  );
}

export function FrontSilhouette() {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g
        fill="rgba(74, 222, 128, 0.18)"
        stroke="rgba(74, 222, 128, 0.85)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      >
        {/* Front-facing body silhouette, arms slightly out (A-pose). */}
        <path
          d="
            M 50 14
            c -5 0 -8 3.5 -8 8.5
            c 0 3 1 5.5 2.5 7
            c -1.5 1 -2 2 -2.5 3.5
            l -0.5 2
            c -4 0.5 -7 2 -9 4
            l -13 10
            c -2 1.5 -3 3.5 -3 6
            l 0 15
            c 0 2 2 3 3.5 2.5
            c 1.5 -0.5 2.5 -2 2.5 -4
            l 0 -10
            l 6 -5
            l 0 23
            c 0 5 1 9 3 13
            l 3 22
            l -3 34
            c 0 1.5 1 2.5 2.5 2.5
            l 4 0
            c 1.5 0 2.5 -1 2.5 -2.5
            l 2 -33
            l 2 -22
            l 2 22
            l 2 33
            c 0 1.5 1 2.5 2.5 2.5
            l 4 0
            c 1.5 0 2.5 -1 2.5 -2.5
            l -3 -34
            l 3 -22
            c 2 -4 3 -8 3 -13
            l 0 -23
            l 6 5
            l 0 10
            c 0 2 1 3.5 2.5 4
            c 1.5 0.5 3.5 -0.5 3.5 -2.5
            l 0 -15
            c 0 -2.5 -1 -4.5 -3 -6
            l -13 -10
            c -2 -2 -5 -3.5 -9 -4
            l -0.5 -2
            c -0.5 -1.5 -1 -2.5 -2.5 -3.5
            c 1.5 -1.5 2.5 -4 2.5 -7
            c 0 -5 -3 -8.5 -8 -8.5
            Z
          "
        />
      </g>
      {/* guidance label */}
      <g>
        <rect
          x="28"
          y="168"
          width="44"
          height="7"
          rx="1.2"
          fill="rgba(0,0,0,0.55)"
        />
        <text
          x="50"
          y="173"
          textAnchor="middle"
          fontSize="4"
          fill="white"
          fontFamily="sans-serif"
        >
          face camera, arms out
        </text>
      </g>
    </svg>
  );
}

export function ProfileSilhouette() {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g
        fill="rgba(96, 165, 250, 0.18)"
        stroke="rgba(96, 165, 250, 0.85)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      >
        {/* Side profile silhouette facing right. */}
        <path
          d="
            M 55 14
            c -5 0 -9 3.5 -9 8.5
            c 0 2.5 0.6 4.8 1.8 6.5
            c -0.5 1 -0.8 2 -1 3
            l -0.5 2.5
            c -2.5 0.8 -4.2 2.5 -5 5
            l -2 10
            c -0.4 2 0.5 3.5 2 4
            c 1.5 0.5 2.8 -0.4 3.5 -2
            l 2 -5
            l 0 21
            c 0 5 0.8 9 2.5 13
            l 3 22
            l -3 34
            c 0 1.5 1 2.5 2.5 2.5
            l 4 0
            c 1.5 0 2.5 -1 2.5 -2.5
            l 2 -33
            l 2 -22
            l 2 22
            l 2 33
            c 0 1.5 1 2.5 2.5 2.5
            l 4 0
            c 1.5 0 2.5 -1 2.5 -2.5
            l -3 -34
            l 3 -22
            c 1.7 -4 2.5 -8 2.5 -13
            l 0 -21
            c 0 -4 -1.5 -6.5 -4 -8
            l -4.5 -2.5
            l -0.5 -2.5
            c -0.2 -1 -0.5 -2 -1 -3
            c 1.2 -1.7 1.8 -4 1.8 -6.5
            c 0 -5 -4 -8.5 -9 -8.5
            Z
          "
        />
      </g>
      <g>
        <rect
          x="24"
          y="168"
          width="52"
          height="7"
          rx="1.2"
          fill="rgba(0,0,0,0.55)"
        />
        <text
          x="50"
          y="173"
          textAnchor="middle"
          fontSize="4"
          fill="white"
          fontFamily="sans-serif"
        >
          turn 90°, arms at sides
        </text>
      </g>
    </svg>
  );
}
