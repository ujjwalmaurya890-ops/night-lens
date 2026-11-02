import { getSiteMode } from './hostname';
import type { Settings, SiteMode, SiteStatus } from './types';

export type Decision =
  | { active: true; forceNative: boolean; siteMode: SiteMode | null }
  | { active: false; status: Exclude<SiteStatus, 'active' | 'native-dark'>; siteMode: SiteMode | null };

function isWithinSchedule(schedule: Settings['schedule'], now: Date = new Date()): boolean {
  if (!schedule.enabled) return true; // no schedule = always active if other checks pass
  const [sh, sm] = schedule.start.split(':').map(Number) as [number, number];
  const [eh, em] = schedule.end.split(':').map(Number) as [number, number];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  if (startMins === endMins) return true; // 00:00-00:00 means always
  if (startMins < endMins) {
    return nowMins >= startMins && nowMins < endMins;
  } else {
    // Overnight schedule e.g. 22:00-07:00
    return nowMins >= startMins || nowMins < endMins;
  }
}

/** Pure decision: should the engine run on this site right now? */
export function decide(settings: Settings, hostname: string | null, systemPrefersDark: boolean, now: Date = new Date()): Decision {
  const siteMode = getSiteMode(settings.siteRules, hostname) ?? null;
  if (!settings.enabled) return { active: false, status: 'globally-off', siteMode };

  // Schedule check
  if (settings.schedule.enabled && !isWithinSchedule(settings.schedule, now)) {
    // If site is forced on, schedule doesn't block it
    if (siteMode !== 'on') {
      return { active: false, status: 'scheduled-off' as any, siteMode };
    }
  }

  if (siteMode === 'off') return { active: false, status: 'excluded', siteMode };
  if (settings.theme === 'system' && !systemPrefersDark) return { active: false, status: 'waiting-for-system', siteMode };
  // Also respect schedule.followSystem if enabled
  if (settings.schedule.followSystem && !systemPrefersDark && !siteMode) {
    return { active: false, status: 'waiting-for-system', siteMode };
  }
  return { active: true, forceNative: siteMode === 'on', siteMode };
}

export function shouldApplyPerSiteTheme(settings: Settings, hostname: string | null): string | null {
  if (!hostname) return null;
  return settings.siteThemes[hostname] ?? null;
}

export function getEffectiveTheme(settings: Settings, hostname: string | null): string {
  if (hostname) {
    const perSite = settings.siteThemes[hostname];
    if (perSite) return perSite;
    const override = settings.siteOverrides[hostname];
    if (override?.theme) return override.theme;
  }
  return settings.theme;
}

export function getEffectiveSettings(settings: Settings, hostname: string | null): Settings {
  if (!hostname) return settings;
  const override = settings.siteOverrides[hostname];
  if (!override) return settings;
  return {
    ...settings,
    theme: override.theme ?? settings.theme,
    brightness: override.brightness ?? settings.brightness,
    contrast: override.contrast ?? settings.contrast,
    warmth: override.warmth ?? settings.warmth,
    sepia: override.warmth ?? settings.sepia,
    saturation: override.saturation ?? settings.saturation,
  };
}

export { isWithinSchedule };
