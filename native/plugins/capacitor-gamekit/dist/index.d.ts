import type { PluginListenerHandle } from '@capacitor/core';

/** Signed-in Game Center player; `playerId` is null when signed out. */
export interface GameKitPlayer {
  playerId: string | null;
  displayName?: string;
}

export interface GameKitPlugin {
  /** Resolves the signed-in player, or rejects with code NOT_AUTHENTICATED. */
  signIn(): Promise<GameKitPlayer>;
  submitScore(options: { leaderboardId: string; score: number }): Promise<void>;
  /** Resolves once the native leaderboard screen is on screen. */
  showLeaderboard(options: { leaderboardId: string }): Promise<void>;
  unlockAchievement(options: { achievementId: string; percent?: number }): Promise<void>;
  /** Resolves once the native achievements screen is on screen. */
  showAchievements(): Promise<void>;
  /** Asks StoreKit for the App Store rating sheet (iOS decides whether it shows). */
  requestReview(): Promise<void>;
  /** iCloud key-value store (needs the ubiquity-kvstore-identifier entitlement to sync). */
  cloudGet(options: { key: string }): Promise<{ value: string | null }>;
  cloudPut(options: { key: string; value: string }): Promise<{ synced: boolean }>;
  /** Fires on every Game Center auth change (sign-out, account switch). */
  addListener(
    eventName: 'playerChanged',
    listener: (player: GameKitPlayer) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export declare const GameKit: GameKitPlugin;
