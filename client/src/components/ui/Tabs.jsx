import React, { useState } from 'react';

/**
 * Accessible Tabs Component with Keyboard Arrow Navigation
 */
export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabListClassName = ''
}) => {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id);
  const current = activeTab !== undefined ? activeTab : internalActive;

  const handleSelect = (id) => {
    if (activeTab === undefined) {
      setInternalActive(id);
    }
    onChange?.(id);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (index + 1) % tabs.length;
      handleSelect(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      handleSelect(tabs[prevIndex].id);
    }
  };

  const activeContent = tabs.find((t) => t.id === current)?.content;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab List */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={`flex items-center gap-1.5 p-1.5 bg-[#0B192C] border border-[#1B3A60] rounded-2xl overflow-x-auto ${tabListClassName}`}
      >
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === current;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap select-none flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52D68A] ${
                isSelected
                  ? 'bg-[#52D68A] text-[#0B192C] shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-[#0F2238]'
              }`}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-[#0B192C]/20 text-[#0B192C]' : 'bg-[#1B3A60] text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${current}`}
        aria-labelledby={`tab-${current}`}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#52D68A]"
      >
        {activeContent}
      </div>
    </div>
  );
};

export default Tabs;
