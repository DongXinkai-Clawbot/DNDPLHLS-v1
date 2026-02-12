import React from 'react';
import { NamingSetupScreen } from '../NamingSetupScreen';
import { DevZoneLoader } from '../devzone/DevZoneLoader';
import { DevDiagnosticsPanel } from '../dev/DevDiagnosticsPanel';
import { NotificationCenter } from './NotificationCenter';
import { StorageRecoveryBanner } from './StorageRecoveryBanner';
import { AuthOverlay } from '../auth/AuthOverlay';

type AppShellProps = {
  appMode: 'lattice' | 'museum';
  isArActive: boolean;
  containerStyle: React.CSSProperties;
  museumContainerStyle: React.CSSProperties;
  showNamingSetup: boolean;
  showDevDiagnostics: boolean;
  onCloseNamingSetup: () => void;
  children: React.ReactNode;
};

export const AppShell = ({
  appMode,
  isArActive,
  containerStyle,
  museumContainerStyle,
  showNamingSetup,
  showDevDiagnostics,
  onCloseNamingSetup,
  children
}: AppShellProps) => (
  <div
    className={`relative w-full overflow-hidden select-none font-sans ${isArActive && appMode !== 'museum' ? 'bg-transparent' : ''}`}
    style={appMode === 'museum' ? museumContainerStyle : containerStyle}
  >
    {children}
    <StorageRecoveryBanner />
    {showNamingSetup && <NamingSetupScreen onClose={onCloseNamingSetup} />}
    {showDevDiagnostics && <DevDiagnosticsPanel />}
    <AuthOverlay showButton={false} />
    <NotificationCenter />
    <DevZoneLoader />
  </div>
);
