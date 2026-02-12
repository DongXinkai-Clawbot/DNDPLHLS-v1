import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEYS } from '../../store/logic/storageKeys';
const ADVANCED_FLAGS = { v: 1, landingMode: 'advanced', isSetupComplete: true };

const DISABLE_MOTION_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
  * {
    caret-color: transparent !important;
  }
`;

const seedAdvancedFlags = async (page: Page) => {
  await page.addInitScript(
    (payload: { keys: typeof STORAGE_KEYS; flags: typeof ADVANCED_FLAGS }) => {
      localStorage.setItem(payload.keys.flags, JSON.stringify(payload.flags));
      localStorage.removeItem(payload.keys.settings);
      localStorage.removeItem(payload.keys.panels);
    },
    { keys: STORAGE_KEYS, flags: ADVANCED_FLAGS }
  );
};

const preparePage = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: DISABLE_MOTION_CSS });
  await page.evaluate(async () => {
    if (document.fonts && 'ready' in document.fonts) {
      await document.fonts.ready;
    }
  });
  await page.waitForTimeout(200);
};

const dismissAudioGate = async (page: Page) => {
  const tap = page.getByRole('button', { name: 'TAP TO START' });
  if (await tap.isVisible()) {
    await tap.click();
    await page.waitForTimeout(200);
  }
};

const dismissNamingSetup = async (page: Page) => {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible()) {
    await skip.click();
    await page.waitForTimeout(200);
  }
};

const openSettingsOverlay = async (page: Page, isMobile: boolean) => {
  if (isMobile) {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByText('Config', { exact: true }).waitFor();
  } else {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Config' }).click();
    await page.getByText('CONFIG', { exact: true }).waitFor();
  }
  await page.waitForTimeout(200);
};

test('Core navigation flow', async ({ page }, testInfo) => {
  await seedAdvancedFlags(page);
  await page.goto('/');
  await preparePage(page);
  await dismissNamingSetup(page);
  await dismissAudioGate(page);
  await page.locator('canvas').first().waitFor();

  await openSettingsOverlay(page, !!testInfo.project.use?.isMobile);
  await page.getByRole('button', { name: 'Sound' }).click();
  await page.getByText('Tuner (Microtonal)').waitFor();

  await page.goto('/#/museum');
  await preparePage(page);
  await page.locator('canvas').first().waitFor();

  await page.goto('/');
  await preparePage(page);
  await dismissNamingSetup(page);
  await page.locator('canvas').first().waitFor();
});
