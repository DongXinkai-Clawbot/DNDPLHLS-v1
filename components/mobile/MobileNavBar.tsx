import React from 'react';

export type MobileNavItemId = 'settings' | 'keyboard' | 'tuning' | 'tools';

type MobileNavBarProps = {
  active: MobileNavItemId | null;
  onSelect: (id: MobileNavItemId) => void;
};

const NavIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="h-6 w-6">{children}</div>
);

export const MobileNavBar = ({ active, onSelect }: MobileNavBarProps) => {
  const navItems: { id: MobileNavItemId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <NavIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6Z" />
          </svg>
        </NavIcon>
      )
    },
    {
      id: 'keyboard',
      label: 'Keyboard',
      icon: (
        <NavIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M7 10h2M11 10h2M15 10h2M7 14h10" />
          </svg>
        </NavIcon>
      )
    },
    {
      id: 'tuning',
      label: 'Tuning',
      icon: (
        <NavIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3v18" />
            <path d="M18 3v18" />
            <path d="M6 7c3 2 9 2 12 0" />
            <path d="M6 17c3-2 9-2 12 0" />
          </svg>
        </NavIcon>
      )
    },
    {
      id: 'tools',
      label: 'Control',
      icon: (
        <NavIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4 12h4" />
            <path d="M16 12h4" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </NavIcon>
      )
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-auto border-t border-gray-800 bg-black/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`min-h-[44px] min-w-[64px] rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors active:scale-95 ${
                isActive ? 'bg-blue-600/30 text-white' : 'text-gray-400'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-current">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
