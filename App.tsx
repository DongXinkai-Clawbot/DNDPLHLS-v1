import React from 'react';
import { shallow } from 'zustand/shallow';
import { AppShell } from './components/app/AppShell';
import { ModeRouter } from './components/app/ModeRouter';
import { ServiceBootstrap } from './components/app/ServiceBootstrap';
import { useDeviceType } from './hooks/useDeviceType';
import { useStore } from './store';
import {
  selectAppActions,
  selectAppFlags,
  selectAppVisuals,
  selectNamingSetupOpen
} from './store/selectors';
import { STORAGE_KEYS } from './store/logic/storageKeys';
import { isNativeAndroid } from './utils/capabilities';

const App = () => {
  const { appMode, landingMode, isSetupComplete } = useStore(selectAppFlags, shallow);
  const { isArActive, backgroundImageUrl, backgroundColor, namingSetupCompleted } = useStore(selectAppVisuals, shallow);
  const namingSetupOpen = useStore(selectNamingSetupOpen);
  const { setAppMode, updateSettings, setNamingSetupOpen } = useStore(selectAppActions, shallow);
  const { isMobile: deviceIsMobile } = useDeviceType();

  const isNativeAndroidDevice = isNativeAndroid();
  const needsNamingSetup = !namingSetupCompleted && (landingMode === 'simple' || landingMode === 'tutorial' || landingMode === 'advanced');
  const showNamingSetup = appMode === 'lattice' && (namingSetupOpen || needsNamingSetup);
  const showDevDiagnostics =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(STORAGE_KEYS.devDiagnostics) === '1';

  const containerStyle: React.CSSProperties = backgroundImageUrl
    ? {
      backgroundImage: `url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      height: '100dvh'
    }
    : {
      backgroundColor: isArActive ? 'transparent' : backgroundColor,
      minHeight: '100vh',
      height: '100dvh'
    };
  const museumContainerStyle: React.CSSProperties = {
    backgroundColor: '#030712',
    minHeight: '100vh',
    height: '100dvh'
  };

  return (
    <AppShell
      appMode={appMode}
      isArActive={isArActive}
      containerStyle={containerStyle}
      museumContainerStyle={museumContainerStyle}
      showNamingSetup={showNamingSetup}
      showDevDiagnostics={showDevDiagnostics}
      onCloseNamingSetup={() => setNamingSetupOpen(false)}
    >
      <ServiceBootstrap setAppMode={setAppMode} updateSettings={updateSettings} />
      <ModeRouter
        appMode={appMode}
        landingMode={landingMode}
        isSetupComplete={isSetupComplete}
        deviceIsMobile={deviceIsMobile}
        isArActive={isArActive}
        isNativeAndroid={isNativeAndroidDevice}
      />
    </AppShell>
  );
};

export default App;
