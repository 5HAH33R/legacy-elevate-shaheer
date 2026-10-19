export const THEME_STORAGE_KEY = "elevate-theme";

export type ThemePreference = "light" | "dark";

/**
 * Runs before first paint to apply a saved theme and avoid a flash of the
 * wrong theme. With no saved choice, CSS falls back to the OS preference.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
