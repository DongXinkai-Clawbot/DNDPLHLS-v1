import type React from 'react';

export type TutorialGuard = {
  canAdvance: () => boolean;
  blockReason?: string;
};

export type TutorialStep = {
  title: string;
  desc: string;
  actionLabel?: string;
  onActivate: () => void;
  extraContent?: React.ReactNode;
  guard?: TutorialGuard;
  onAdvance?: () => void;
};
