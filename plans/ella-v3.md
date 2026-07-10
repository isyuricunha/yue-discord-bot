# Ella v3 Migration

## Milestone 1: AI runtime migration

- [x] Remove Groq and all multi-key fallback behavior from the bot runtime.
- [x] Rename provider-specific conversation state to neutral AI conversation state.
- [x] Keep Discord chat and Agent capabilities on Mistral only.
- [x] Verify bot lint, type-check, and tests.

## Milestone 2: Owner-controlled panel runtime

- [ ] Add global Ella runtime settings to `BotSettings`.
- [ ] Add generic OpenAI-compatible Custom Provider client.
- [ ] Persist a manually refreshed, cached Custom Provider model catalog.
- [ ] Add Owner-only status, model selection, refresh, and safe test endpoints.
- [ ] Verify API and database checks.

## Milestone 3: Ella panel assistant

- [ ] Add the Owner configuration UI for Ella.
- [ ] Add guild-admin-only panel chat with short-lived conversation state.
- [ ] Provide operational and detailed context by default.
- [ ] Require confirmation before sensitive context or any mutation.
- [ ] Verify web, API, and end-to-end permission boundaries.

## Milestone 4: Release

- [ ] Document environment variables and v3 breaking changes.
- [ ] Verify conventional commits produce a major release for breaking changes.
- [ ] Run workspace lint, type-check, test, and build.
- [ ] Create release tag `v3.0.0`.
