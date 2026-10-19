// Vitest alias target for the "server-only" package (see vitest.config.mts).
// The real package throws when imported outside React Server Components;
// in unit tests that boundary is a convention, not a runtime check.
export {};
