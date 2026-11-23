import React from 'react';

/**
 * Adaptive AI Mascot Silhouette Logo
 * Scalable icon matching the robot silhouette in the top-left navbar.
 */
export const AdaptiveAILogo = ({
  size = 32,
  iconColor = '#0B192C',
  eyeColor = '#52D68A',
  className = ''
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none ${className}`}
    >
      {/* Robot Antennae */}
      <rect x="6.5" y="3.5" width="2.5" height="5" rx="1.25" fill={iconColor} />
      <rect x="23" y="3.5" width="2.5" height="5" rx="1.25" fill={iconColor} />

      {/* Head Chassis */}
      <rect x="4" y="7" width="24" height="20" rx="7" fill={iconColor} />

      {/* Visor Screen / Cutout */}
      <rect x="7" y="10" width="18" height="13" rx="4" fill={iconColor} />

      {/* Eyes */}
      <ellipse cx="11.5" cy="16.5" rx="2.2" ry="2.6" fill={eyeColor} />
      <ellipse cx="20.5" cy="16.5" rx="2.2" ry="2.6" fill={eyeColor} />

      {/* Cute Smile */}
      <path
        d="M 13.5 20.5 Q 16 22 18.5 20.5"
        stroke={eyeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

export default AdaptiveAILogo;
