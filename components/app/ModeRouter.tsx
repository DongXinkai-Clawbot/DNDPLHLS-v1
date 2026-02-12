import React, { Suspense } from 'react';
import Lattice3D from '../Lattice3D';
import { DesktopOverlay } from '../DesktopOverlay';
import { MobileOverlay } from '../mobile/MobileOverlay';
import { MobileErrorBoundary } from '../mobile/MobileErrorBoundary';
import { RatioStatisticsPanel } from '../overlays/RatioStatisticsPanel';
import { SetupScreen } from '../SetupScreen';
import { LandingPage } from '../LandingPage';
import { ARContainer } from '../ARContainer';
import { NativeARContainer } from '../nativeAR/NativeARContainer';
import { MuseumScene } from '../museum/MuseumScene';
import { MuseumHUD } from '../museum/MuseumHUD';
import { MuseumUX } from '../museum/MuseumUX';

type ModeRouterProps = {
  appMode: 'lattice' | 'museum';
  landingMode: string;
  isSetupComplete: boolean;
  deviceIsMobile: boolean;
  isArActive: boolean;
  isNativeAndroid: boolean;
};

export const ModeRouter = ({
  appMode,
  landingMode,
  isSetupComplete,
  deviceIsMobile,
  isArActive,
  isNativeAndroid
}: ModeRouterProps) => {
  const showLandingPage = landingMode === 'none' || (!isSetupComplete && landingMode !== 'advanced');
  if (appMode === 'museum') {
    return (
      <>
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-white font-mono animate-pulse">Loading Museum...</div>}>
          <MuseumScene />
        </Suspense>
        <MuseumUX />
        <MuseumHUD />
      </>
    );
  }

  return (
    <>
      {showLandingPage && <LandingPage />}

      {landingMode === 'advanced' && !isSetupComplete && <SetupScreen />}

      {isSetupComplete && (
        <>
          {deviceIsMobile ? (
            <MobileErrorBoundary>
              {isArActive ? (
                <Suspense fallback={null}>
                  {isNativeAndroid ? <NativeARContainer /> : <ARContainer />}
                </Suspense>
              ) : (
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-white font-mono animate-pulse z-20 pointer-events-none">
                      Initializing multidimensional n-limits lattice...
                    </div>
                  }
                >
                  <Lattice3D isMobile />
                </Suspense>
              )}
              {!isArActive && <MobileOverlay />}
              {!isArActive && <RatioStatisticsPanel />}
            </MobileErrorBoundary>
          ) : (
            <>
              {isArActive ? (
                <Suspense fallback={null}>
                  {isNativeAndroid ? <NativeARContainer /> : <ARContainer />}
                </Suspense>
              ) : (
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-white font-mono animate-pulse z-20 pointer-events-none">
                      Initializing multidimensional n-limits lattice...
                    </div>
                  }
                >
                  <Lattice3D isMobile={deviceIsMobile} />
                </Suspense>
              )}
              {!isArActive && <DesktopOverlay />}
              {!isArActive && <RatioStatisticsPanel />}
            </>
          )}
        </>
      )}
    </>
  );
};
