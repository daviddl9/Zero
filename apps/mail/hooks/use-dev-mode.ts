/**
 * Hook to check if development mode is enabled.
 * Returns true in Vite dev mode or when VITE_PUBLIC_DEV_TOOLS env var is set.
 */
export function useDevMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PUBLIC_DEV_TOOLS === 'true';
}
