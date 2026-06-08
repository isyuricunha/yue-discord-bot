# YuDark Theme Refactor Plan

## Milestone 1 - Web theme token refactor

- [x] Scan the existing web styling stack and confirm the theme layer already exists.
- [x] Reuse Tailwind and the existing global CSS token architecture.
- [x] Add YuDark Theme tokens under the `yudark` theme id.
- [x] Preserve the legacy `yu-dark` selector and `cursor-*` variables/classes as compatibility aliases.
- [x] Update Tailwind semantic colors, radii, and shadows to read from YuDark tokens.
- [x] Switch rendered web roots and fallback screens to `data-theme="yudark"`.
- [x] Update global links, scrollbars, inline code, code blocks, blockquotes, rounded helpers, shimmer text, and skeleton states.
- [x] Run lint, type-check, tests, and build for the web package.
- [x] Run local browser rendered-state verification for the web app.
- [x] Self-review the final diff for imports, exports, theme selectors, and CSS variable coverage.

## Validation Notes

- Web validation passed with `pnpm --filter @yuebot/web lint`, `type-check`, `test`, and `build`.
- Browser state checks passed on `/login` and `/extras`: `data-theme="yudark"`, `--yu-bg-canvas: #000000`, `--yu-accent: #ffa726`, and rounded surfaces were present.
- In-app browser screenshot capture timed out twice, so verification used computed rendered styles and visible page text instead of saved screenshots.

## Follow-up Candidates

- [ ] Rename `cursor-*` utility classes to `yudark-*` in a separate cleanup after screenshots confirm parity.
- [ ] Review page-specific status color classes if product direction requires removing legacy blue or purple class names entirely.
