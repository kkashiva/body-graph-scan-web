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

export function FrontSilhouette({ gender }: { gender?: string | null }) {
  const isFemale = gender === 'female';

  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g
        fill="rgba(255, 2, 131, 0.15)"
        stroke="rgba(255, 2, 131, 0.85)"
        strokeWidth="0.55"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {isFemale ? (
          <>
            {/* ── Female full-body outline ── */}
            <path
              d="
                M 50 12
                C 45.5 12, 43 15.5, 43 19
                C 43 22.5, 45 25.5, 47 27
                L 46 28
                C 44.5 29, 43 30, 42 32
                L 41 34
                C 39 34.5, 37.5 35, 36 36
                L 33 37.5
                C 30 39, 28.5 41, 27 44
                L 24.5 51
                C 23 55, 22 58, 21 62

                C 20 67, 18.5 72, 18 76
                L 17 82
                C 16.5 85, 16 88, 16.5 90
                C 17 92, 18 93, 19 93
                C 20 93, 21 92, 21.5 90
                L 23 82
                C 24 77, 25 73, 26.5 68
                L 28 62
                C 29 58, 30 55.5, 31 53

                L 32 50
                C 33 47.5, 34 46, 35 45
                L 34.5 51
                C 34 56, 33.5 61, 33 66
                C 32.5 72, 33 78, 34 83
                C 35 89, 36.5 94, 37 98
                L 37.5 103
                C 38 108, 38 112, 37.5 116
                L 36.5 124
                C 36 130, 35.5 136, 35 141
                L 34.5 148
                C 34 152, 34 156, 34 159
                L 34 162
                C 33.5 164, 33 166.5, 35 168
                L 38 169
                C 40 168, 39 165, 39 162
                L 40 156
                C 40.5 150, 41 145, 42 139
                L 43 132
                C 44 127, 45 123, 46 119
                L 47.5 112
                C 48.5 109, 49 107, 50 105

                C 51 107, 51.5 109, 52.5 112
                L 54 119
                C 55 123, 56 127, 57 132
                L 58 139
                C 59 145, 59.5 150, 60 156
                L 61 162
                C 61 165, 60 168, 62 169
                L 65 168
                C 67 166.5, 66.5 164, 66 162
                L 66 159
                C 66 156, 66 152, 65.5 148
                L 65 141
                C 64.5 136, 64 130, 63.5 124
                L 62.5 116
                C 62 112, 62 108, 62.5 103
                L 63 98
                C 63.5 94, 65 89, 66 83
                C 67 78, 67.5 72, 67 66
                C 66.5 61, 66 56, 65.5 51
                L 65 45

                C 66 46, 67 47.5, 68 50
                L 69 53
                C 70 55.5, 71 58, 72 62
                L 73.5 68
                C 75 73, 76 77, 77 82
                L 78.5 90
                C 79 92, 80 93, 81 93
                C 82 93, 83 92, 83.5 90
                C 84 88, 83.5 85, 83 82
                L 82 76
                C 81.5 72, 80 67, 79 62

                C 78 58, 77 55, 75.5 51
                L 73 44
                C 71.5 41, 70 39, 67 37.5
                L 64 36
                C 62.5 35, 61 34.5, 59 34
                L 58 32
                C 57 30, 55.5 29, 54 28
                L 53 27
                C 55 25.5, 57 22.5, 57 19
                C 57 15.5, 54.5 12, 50 12
                Z
              "
            />
            {/* ── Sports bra ── */}
            <path
              d="
                M 38.5 36 L 40 44 C 42 50, 45.5 52, 50 52 C 54.5 52, 58 50, 60 44 L 61.5 36
                M 40 44 C 43 47, 46 48.5, 50 48.5 C 54 48.5, 57 47, 60 44
                M 44 37 C 43 41, 43 44, 45 47
                M 56 37 C 57 41, 57 44, 55 47
              "
              fill="none"
            />
            {/* ── Shorts ── */}
            <path
              d="
                M 33.5 83 C 42 85.5, 58 85.5, 66.5 83
                M 33 86 C 42 88.5, 58 88.5, 67 86
                M 37 103 C 41 106, 45 107, 50 104
                M 63 103 C 59 106, 55 107, 50 104
              "
              fill="none"
            />
          </>
        ) : (
          <>
            {/* ── Male full-body outline ── */}
            <path
              d="
                M 50 12
                C 45.5 12, 43 15.5, 43 19
                C 43 22.5, 44.5 25, 46.5 27
                L 46 28
                C 44.5 29, 43 30, 42 32
                L 40 34.5
                C 37.5 35.5, 35 36.5, 32 38
                L 28 41
                C 25 43, 23 45, 21 49
                L 18 57
                C 16 62, 14.5 67, 13.5 72

                C 12.5 77, 12 82, 12 86
                L 11.5 90
                C 11 92, 12 94, 13.5 94
                C 15 94, 16 93, 16.5 91
                L 18 84
                C 19 79, 20 74, 21.5 69
                L 24 62
                C 25.5 58, 27 55, 28.5 52

                L 30 49
                C 31 47, 32 45.5, 33 44.5
                L 33 50
                C 32.5 55, 32 60, 32 65
                C 32 71, 32.5 76, 33.5 81
                C 34 86, 34.5 90, 35 93
                L 35.5 97
                C 36 101, 36 105, 35.5 109
                L 35 115
                C 34.5 121, 34 127, 33.5 132
                L 33 139
                C 32.5 145, 32.5 150, 32.5 154
                L 32.5 158
                C 32 162, 31.5 165, 33.5 167
                L 37 168
                C 39 167, 38.5 164, 38.5 161
                L 39 155
                C 39.5 149, 40 144, 41 138
                L 42.5 130
                C 43.5 125, 44.5 121, 46 116
                L 48 108
                C 49 105, 49.5 103, 50 101

                C 50.5 103, 51 105, 52 108
                L 54 116
                C 55.5 121, 56.5 125, 57.5 130
                L 59 138
                C 60 144, 60.5 149, 61 155
                L 61.5 161
                C 61.5 164, 61 167, 63 168
                L 66.5 167
                C 68.5 165, 68 162, 67.5 158
                L 67.5 154
                C 67.5 150, 67.5 145, 67 139
                L 66.5 132
                C 66 127, 65.5 121, 65 115
                L 64.5 109
                C 64 105, 64 101, 64.5 97
                L 65 93
                C 65.5 90, 66 86, 66.5 81
                C 67.5 76, 68 71, 68 65
                C 68 60, 67.5 55, 67 50
                L 67 44.5

                C 68 45.5, 69 47, 70 49
                L 71.5 52
                C 73 55, 74.5 58, 76 62
                L 78.5 69
                C 80 74, 81 79, 82 84
                L 83.5 91
                C 84 93, 85 94, 86.5 94
                C 88 94, 89 92, 88.5 90
                L 88 86
                C 88 82, 87.5 77, 86.5 72

                C 85.5 67, 84 62, 82 57
                L 79 49
                C 77 45, 75 43, 72 41
                L 68 38
                C 65 36.5, 62.5 35.5, 60 34.5
                L 58 32
                C 57 30, 55.5 29, 54 28
                L 53.5 27
                C 55.5 25, 57 22.5, 57 19
                C 57 15.5, 54.5 12, 50 12
                Z
              "
            />
            {/* ── Boxer briefs waistband ── */}
            <path
              d="
                M 34.5 88 C 42 90, 58 90, 65.5 88
                M 34 91 C 42 93, 58 93, 66 91
              "
              fill="none"
            />
            {/* ── Boxer briefs leg openings ── */}
            <path
              d="
                M 35.5 109 C 39 111.5, 43 112, 48 108
                M 64.5 109 C 61 111.5, 57 112, 52 108
              "
              fill="none"
            />
            {/* ── Boxer briefs fly/seam ── */}
            <path
              d="
                M 48 91 C 47 96, 47 101, 49 106
                C 50 108, 51 108, 52 106
                C 53.5 101, 53 96, 52 91
              "
              fill="none"
            />
          </>
        )}
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
        fill="rgba(255, 2, 131, 0.18)"
        stroke="rgba(255, 2, 131, 0.85)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      >
        {/* Side profile silhouette facing right. */}
        <path
          d="
            M 48 16
            C 51 15, 54 18, 55 21
            L 56 23
            L 58 25
            L 56 27
            L 57 29
            L 55 31
            L 53 36
            C 56 42, 61 50, 62 60
            C 62 75, 60 90, 60 105
            L 61 148
            C 50 152, 45 152, 38 148
            L 35 120
            C 34 110, 32 105, 34 95
            C 36 85, 41 78, 40 60
            C 39 45, 42 38, 44 35
            L 42 28
            C 41 22, 43 17, 48 16
            Z
          "
        />
        {/* Briefs outline */}
        <path
          d="
            M 32 105 L 60 105
            M 60.5 125 Q 48 115 36 120
          "
          fill="none"
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
