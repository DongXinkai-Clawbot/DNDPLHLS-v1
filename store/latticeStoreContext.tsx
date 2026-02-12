import React, { createContext, useContext } from 'react';
import { useStore as useZustandStore } from 'zustand';
import type { StoreApi } from 'zustand';
import { useStore as useGlobalStore } from './storeImpl';

const LatticeStoreContext = createContext<StoreApi<any> | null>(null);

export const LatticeStoreProvider = ({
  store,
  children
}: {
  store: StoreApi<any>;
  children: React.ReactNode;
}) => (
  <LatticeStoreContext.Provider value={store}>{children}</LatticeStoreContext.Provider>
);

export const useLatticeStore = <T,>(
  selector: (state: any) => T,
  equalityFn?: (a: T, b: T) => boolean
) => {
  const store = useContext(LatticeStoreContext);
  if (store) {
    return useZustandStore(store, selector, equalityFn);
  }
  return useGlobalStore(selector, equalityFn);
};

export const useLatticeStoreApi = () => {
  const store = useContext(LatticeStoreContext);
  return store ?? useGlobalStore;
};
