/** Default `.gitchangeignore` patterns (D-10). Extensible at load time via repo file. */
export const DEFAULT_GITCHANGEIGNORE: readonly string[] = [
  ".env*",
  "**/secrets/**",
  "*credentials*",
  "*.pem",
  "*.key",
];
