import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible Keyboard-Operable Modal Dialog
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-2xl',
  className = ''
}) => {
  const modalRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      <div
        ref={modalRef}
        className={`relative w-full ${maxWidth} bg-[#0F2238] border border-[#1B3A60] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col focus:outline-none ${className}`}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#0B192C] border-b border-[#1B3A60] flex items-center justify-between shrink-0">
          <div>
            {title && (
              <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p id="modal-description" className="text-xs text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52D68A]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-200">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
