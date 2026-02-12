import React from 'react';
import { MuseumArchitecture } from './MuseumArchitecture';
import { MuseumWayfinding } from './MuseumWayfinding';
import { MuseumEntryPlaque } from './MuseumEntryPlaque';

export const MuseumEnvironment = () => {
  return (
    <group>
      <MuseumArchitecture />
      <MuseumWayfinding />
      <MuseumEntryPlaque />
    </group>
  );
};
