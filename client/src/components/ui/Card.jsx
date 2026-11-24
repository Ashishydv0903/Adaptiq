import React from 'react';

export const Card = ({ children, className = '', hover = false, ...props }) => (
  <div
    className={`bg-[#0F2238] border border-[#1B3A60] rounded-2xl text-slate-100 ${
      hover ? 'hover:border-[#52D68A]/50 hover:shadow-lg hover:shadow-[#52D68A]/5 transition-all duration-200' : ''
    } ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 pb-3 flex flex-col space-y-1.5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', as: Tag = 'h3', ...props }) => (
  <Tag className={`text-lg font-bold text-white tracking-tight ${className}`} {...props}>
    {children}
  </Tag>
);

export const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-xs sm:text-sm text-slate-300 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 pt-0 flex items-center justify-between border-t border-[#1B3A60]/40 mt-4 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
