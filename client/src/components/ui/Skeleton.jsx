import React from 'react';

/**
 * Accessible Animated Skeleton Loader
 */
export const Skeleton = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  ...props
}) => {
  const base = 'animate-pulse bg-[#1B3A60]/50 rounded-xl';

  const variants = {
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded-md h-4 my-1'
  };

  const style = {
    width: width || undefined,
    height: height || undefined
  };

  return (
    <div
      aria-hidden="true"
      className={`${base} ${variants[variant] || variants.rectangular} ${className}`}
      style={style}
      {...props}
    />
  );
};

export const SkeletonCard = ({ className = '' }) => (
  <div className={`p-6 bg-[#0F2238] border border-[#1B3A60] rounded-2xl space-y-4 ${className}`}>
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" className="w-10 h-10" />
      <div className="space-y-1.5 flex-1">
        <Skeleton variant="text" className="w-1/3 h-4" />
        <Skeleton variant="text" className="w-1/2 h-3" />
      </div>
    </div>
    <div className="space-y-2 pt-2">
      <Skeleton variant="text" className="w-full h-3" />
      <Skeleton variant="text" className="w-5/6 h-3" />
      <Skeleton variant="text" className="w-2/3 h-3" />
    </div>
    <div className="pt-4 flex justify-between items-center">
      <Skeleton className="w-24 h-8 rounded-xl" />
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
  </div>
);

export default Skeleton;
