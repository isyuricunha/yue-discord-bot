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

## Milestone 2 - YuDark spec refinement

- [x] Re-scan the existing YuDark token layer before editing.
- [x] Read Tailwind CSS theme/directive documentation for the current styling stack.
- [x] Refine YuDark text tokens so normal text is neutral soft gray and warm gold is emphasis-only.
- [x] Refine YuDark accent tokens so primary actions use dark orange-yellow by default with brighter hover.
- [x] Refine YuDark border tokens so common borders are neutral and accent borders are reserved for focus/selected states.
- [x] Prefer Inter and JetBrains Mono in the YuDark font stacks without adding new dependencies.
- [x] Update syntax color tokens to the neutral/warm YuDark palette.
- [x] Run lint, type-check, tests, and build for the web package after refinement.
- [x] Run rendered-state browser verification after refinement.
- [x] Self-review the refinement diff for imports, exports, selectors, variables, and component behavior.

## Validation Notes

- Web validation passed with `pnpm --filter @yuebot/web lint`, `type-check`, `test`, and `build`.
- Initial browser state checks passed on `/login` and `/extras`: `data-theme="yudark"`, `--yu-bg-canvas: #000000`, `--yu-accent: #ffa726`, and rounded surfaces were present.
- In-app browser screenshot capture timed out twice, so verification used computed rendered styles and visible page text instead of saved screenshots.
- Refinement validation passed with `pnpm --filter @yuebot/web lint`, `type-check`, `test`, and `build`.
- Refinement browser checks passed on `/login`: `data-theme="yudark"`, `--yu-bg-canvas: #000000`, `--yu-text-primary: #e0e0e0`, `--yu-text-accent: #e8d4a0`, `--yu-accent: #c98218`, `--yu-accent-hover: #ffa726`, `--yu-border-default: rgba(255, 255, 255, 0.11)`, true-black body background, neutral body text, dark-accent primary button, and rounded near-black surfaces.
- Refinement browser checks passed on `/extras`: `data-theme="yudark"`, true-black canvas, near-black header/card surfaces, neutral header border, dark-accent token, and rounded website cards. A viewport screenshot was captured for visual sanity.

## Follow-up Candidates

- [ ] Rename `cursor-*` utility classes to `yudark-*` in a separate cleanup after screenshots confirm parity.
- [ ] Review page-specific status color classes if product direction requires removing legacy blue or purple class names entirely.
