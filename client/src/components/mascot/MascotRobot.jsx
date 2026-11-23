import React from 'react';

/**
 * Friendly AI Mascot Robot
 * Recreates the cute waving celebratory robot from the design with festive confetti.
 */
export const MascotRobot = ({ className = 'w-full max-w-[420px] h-auto' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Subtle gradients */}
          <linearGradient id="bodyWhite" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="robotBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          <linearGradient id="screenNavy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="coreGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>

          <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
          </filter>
        </defs>

        {/* ================= CONFETTI & RIBBONS ================= */}
        {/* Red ribbons */}
        <path d="M 120 140 Q 130 150 145 145 T 155 160" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" fill="none" />
        <rect x="390" y="120" width="8" height="14" rx="2" fill="#EC4899" transform="rotate(25 390 120)" />
        <rect x="140" y="180" width="12" height="6" rx="2" fill="#EF4444" transform="rotate(-15 140 180)" />
        <path d="M 380 230 Q 395 240 405 235 T 415 250" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* Yellow stars & ribbons */}
        <polygon points="175,130 178,138 186,138 180,143 182,151 175,146 168,151 170,143 164,138 172,138" fill="#FBBF24" />
        <polygon points="360,190 362,196 368,196 363,200 365,206 360,202 355,206 357,200 352,196 358,196" fill="#FBBF24" />
        <rect x="370" y="195" width="10" height="12" rx="2" fill="#F59E0B" transform="rotate(40 370 195)" />
        <rect x="290" y="115" width="8" height="14" rx="2" fill="#FBBF24" transform="rotate(-30 290 115)" />

        {/* Cyan & blue confetti */}
        <path d="M 110 270 Q 120 275 130 270 T 140 280" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" fill="none" />
        <polygon points="135,230 137,236 143,236 138,240 140,246 135,242 130,246 132,240 127,236 133,236" fill="#38BDF8" />
        <path d="M 370 160 Q 380 170 395 165" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Pink & Purple confetti */}
        <rect x="180" y="110" width="8" height="14" rx="2" fill="#F43F5E" transform="rotate(20 180 110)" />
        <rect x="310" y="130" width="10" height="6" rx="2" fill="#A855F7" transform="rotate(-15 310 130)" />

        {/* ================= GROUND SHADOW ================= */}
        <ellipse cx="250" cy="410" rx="90" ry="12" fill="#07101B" opacity="0.6" />
        <ellipse cx="250" cy="408" rx="70" ry="8" fill="#040911" opacity="0.4" />

        {/* ================= WAVING LEFT ARM (Right on viewer side) ================= */}
        {/* Left Arm Resting at side */}
        <g>
          {/* Shoulder */}
          <circle cx="330" cy="245" r="14" fill="#0284C7" />
          {/* Arm segment */}
          <path d="M 330 245 Q 345 280 340 300 Q 330 310 325 300 Z" fill="url(#bodyWhite)" stroke="#CBD5E1" strokeWidth="2" />
          {/* Hand */}
          <circle cx="330" cy="305" r="10" fill="#0284C7" />
        </g>

        {/* ================= ROBOT BODY ================= */}
        <g>
          {/* Outer torso */}
          <rect x="195" y="225" width="110" height="120" rx="40" fill="url(#bodyWhite)" stroke="#CBD5E1" strokeWidth="3" />

          {/* Blue shoulder cap trim */}
          <path d="M 195 245 Q 250 260 305 245 L 305 235 Q 250 250 195 235 Z" fill="#0284C7" />

          {/* Circular glowing chest core */}
          <circle cx="250" cy="285" r="24" fill="#0284C7" />
          <circle cx="250" cy="285" r="17" fill="url(#coreGlow)" />
          <circle cx="250" cy="285" r="11" fill="#FFFFFF" opacity="0.4" />

          {/* Bottom pelvic trim */}
          <path d="M 215 330 Q 250 345 285 330 Q 280 350 250 350 Q 220 350 215 330 Z" fill="#0284C7" />
        </g>

        {/* ================= HEAD & FACE ================= */}
        <g>
          {/* Blue side ears / headphone pieces */}
          <rect x="156" y="145" width="22" height="42" rx="10" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />
          <rect x="322" y="145" width="22" height="42" rx="10" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />

          {/* Small side earlights */}
          <circle cx="167" cy="166" r="4" fill="#38BDF8" />
          <circle cx="333" cy="166" r="4" fill="#38BDF8" />

          {/* Outer white helmet */}
          <rect x="168" y="105" width="164" height="126" rx="58" fill="url(#bodyWhite)" stroke="#CBD5E1" strokeWidth="3" />

          {/* Inner dark screen visor */}
          <rect x="184" y="120" width="132" height="96" rx="42" fill="url(#screenNavy)" />

          {/* Visor glossy reflection curve */}
          <path
            d="M 198 132 C 220 124 280 124 302 132 C 285 137 215 137 198 132 Z"
            fill="#FFFFFF"
            opacity="0.15"
          />

          {/* Smiling Happy Crescent Eyes */}
          {/* Left Eye */}
          <path
            d="M 210 168 C 210 152 232 152 232 168"
            stroke="#60A5FA"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          {/* Right Eye */}
          <path
            d="M 268 168 C 268 152 290 152 290 168"
            stroke="#60A5FA"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />

          {/* Cute glowing eye reflections */}
          <circle cx="218" cy="158" r="2" fill="#FFFFFF" opacity="0.8" />
          <circle cx="276" cy="158" r="2" fill="#FFFFFF" opacity="0.8" />
        </g>

        {/* ================= WAVING RIGHT ARM (Left on viewer side) ================= */}
        <g>
          {/* Shoulder joint */}
          <circle cx="170" cy="245" r="14" fill="#0284C7" />

          {/* Upper arm raised up & left */}
          <path
            d="M 170 245 L 140 215 Q 130 205 145 195 L 175 225 Z"
            fill="url(#bodyWhite)"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* Forearm angled up waving */}
          <path
            d="M 140 215 L 125 185 Q 135 175 148 185 L 160 210 Z"
            fill="url(#bodyWhite)"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* Cute waving hand */}
          <circle cx="128" cy="182" r="14" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M 122 174 Q 132 170 138 182" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  );
};

export default MascotRobot;
