/**
 * Preferences storage — delegates to adapter (Clean Architecture).
 */

import { asyncStoragePreferencesStorage } from "@/adapters";

export const getPreferencesAsync = () => asyncStoragePreferencesStorage.get();
export const setPreferencesAsync = (partial: Parameters<typeof asyncStoragePreferencesStorage.set>[0]) =>
  asyncStoragePreferencesStorage.set(partial);
