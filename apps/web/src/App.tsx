import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useAuthStore } from './store/auth'
import { AppShell, PublicShell, RequireAuth, RequireOwner, RouteLoading } from './components/layout'
import ErrorBoundary from './components/error_boundary'

const LoginPage = lazy(() => import('./pages/Login'))
const TokenLoginPage = lazy(() => import('./pages/TokenLogin'))
const ExtrasPage = lazy(() => import('./pages/Extras'))
const ExtrasHomePage = lazy(() => import('./pages/extras/ExtrasHome'))
const ExtrasAboutPage = lazy(() => import('./pages/extras/ExtrasAbout'))
const ExtrasModerationPage = lazy(() => import('./pages/extras/ExtrasModeration'))
const ExtrasCommandsPage = lazy(() => import('./pages/extras/ExtrasCommands'))
const ExtrasPlaceholdersPage = lazy(() => import('./pages/extras/ExtrasPlaceholders'))
const ExtrasBanAppealPage = lazy(() => import('./pages/extras/ExtrasBanAppeal'))
const TermsPage = lazy(() => import('./pages/Terms'))
const PrivacyPage = lazy(() => import('./pages/Privacy'))
const DashboardPage = lazy(() => import('./pages/Dashboard'))
const GuildPage = lazy(() => import('./pages/Guild'))
const OverviewPage = lazy(() => import('./pages/Overview'))
const ModLogsPage = lazy(() => import('./pages/ModLogs'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogs'))
const CommandsPage = lazy(() => import('./pages/Commands'))
const MembersPage = lazy(() => import('./pages/Members'))
const MemberDetailsPage = lazy(() => import('./pages/MemberDetails'))
const GiveawaysPage = lazy(() => import('./pages/Giveaways'))
const GiveawayDetailsPage = lazy(() => import('./pages/GiveawayDetails'))
const CreateGiveawayPage = lazy(() => import('./pages/CreateGiveaway'))
const GiveawayEntryEditPage = lazy(() => import('./pages/GiveawayEntryEdit'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const ModerationPage = lazy(() => import('./pages/Moderation'))
const AutoModPage = lazy(() => import('./pages/AutoMod'))
const AntiRaidPage = lazy(() => import('./pages/AntiRaid'))
const WelcomePage = lazy(() => import('./pages/Welcome'))
const XpLevelsPage = lazy(() => import('./pages/XpLevels'))
const AutorolePage = lazy(() => import('./pages/Autorole'))
const TicketsPage = lazy(() => import('./pages/Tickets'))
const SetupWizardPage = lazy(() => import('./pages/SetupWizard'))
const SuggestionsPage = lazy(() => import('./pages/Suggestions'))
const ReactionRolesPage = lazy(() => import('./pages/ReactionRoles'))
const StarboardPage = lazy(() => import('./pages/Starboard'))
const BadgesPage = lazy(() => import('./pages/Badges'))
const FanArtsPage = lazy(() => import('./pages/FanArts'))
const EconomyPage = lazy(() => import('./pages/Economy'))
const CoinflipPage = lazy(() => import('./pages/Coinflip'))
const OwnerPage = lazy(() => import('./pages/Owner'))
const MusicPage = lazy(() => import('./pages/Music'))
const CustomCommandsPage = lazy(() => import('./pages/CustomCommands'))
const KeywordTriggersPage = lazy(() => import('./pages/KeywordTriggers'))
const FreeGamesPage = lazy(() => import('./pages/FreeGames'))

function App() {
  const { user, isLoading, initialize } = useAuthStore()

  const isAuthenticated = Boolean(user)
  const isAuthResolved = !isLoading

  useEffect(() => {
    // Initialize authentication from cookies only
    initialize()
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              !isAuthResolved || !isAuthenticated ? (
                <Suspense fallback={<RouteLoading fullScreen />}>
                  <LoginPage />
                </Suspense>
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route
            path="/token-login"
            element={
              !isAuthResolved || !isAuthenticated ? (
                <Suspense fallback={<RouteLoading fullScreen />}>
                  <TokenLoginPage />
                </Suspense>
              ) : (
                <Navigate to="/" />
              )
            }
          />

          <Route element={<PublicShell />}>
            <Route path="/extras" element={<ExtrasPage />}>
              <Route index element={<ExtrasHomePage />} />
              <Route path="sobre" element={<ExtrasAboutPage />} />
              <Route path="moderacao" element={<ExtrasModerationPage />} />
              <Route path="comandos" element={<ExtrasCommandsPage />} />
              <Route path="placeholders" element={<ExtrasPlaceholdersPage />} />
              <Route path="apelo-de-ban" element={<ExtrasBanAppealPage />} />
            </Route>

            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/giveaways/entry/:token" element={<GiveawayEntryEditPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/moderation" element={<Navigate to="/" replace />} />
            <Route path="/guild/:guildId" element={<GuildPage />} />
            <Route path="/guild/:guildId/overview" element={<OverviewPage />} />
            <Route path="/guild/:guildId/automod" element={<AutoModPage />} />
            <Route path="/guild/:guildId/antiraid" element={<AntiRaidPage />} />
            <Route path="/guild/:guildId/modlogs" element={<ModLogsPage />} />
            <Route path="/guild/:guildId/music" element={<MusicPage />} />
            <Route path="/guild/:guildId/custom-commands" element={<CustomCommandsPage />} />
            <Route path="/guild/:guildId/keyword-triggers" element={<KeywordTriggersPage />} />
            <Route path="/guild/:guildId/audit" element={<AuditLogsPage />} />
            <Route path="/guild/:guildId/commands" element={<CommandsPage />} />
            <Route path="/guild/:guildId/members" element={<MembersPage />} />
            <Route path="/guild/:guildId/members/:userId" element={<MemberDetailsPage />} />
            <Route path="/guild/:guildId/giveaways" element={<GiveawaysPage />} />
            <Route path="/guild/:guildId/giveaways/create" element={<CreateGiveawayPage />} />
            <Route path="/guild/:guildId/giveaways/:giveawayId" element={<GiveawayDetailsPage />} />
            <Route path="/guild/:guildId/xp" element={<XpLevelsPage />} />
            <Route path="/guild/:guildId/autorole" element={<AutorolePage />} />
            <Route path="/guild/:guildId/tickets" element={<TicketsPage />} />
            <Route path="/guild/:guildId/suggestions" element={<SuggestionsPage />} />
            <Route path="/guild/:guildId/reaction-roles" element={<ReactionRolesPage />} />
            <Route path="/guild/:guildId/starboard" element={<StarboardPage />} />
            <Route path="/guild/:guildId/free-games" element={<FreeGamesPage />} />
            <Route path="/guild/:guildId/setup" element={<SetupWizardPage />} />
            <Route path="/guild/:guildId/moderation" element={<ModerationPage />} />
            <Route path="/guild/:guildId/welcome" element={<WelcomePage />} />
            <Route path="/guild/:guildId/settings" element={<SettingsPage />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/fanarts" element={<FanArtsPage />} />
            <Route path="/economy" element={<EconomyPage />} />
            <Route path="/coinflip" element={<CoinflipPage />} />
            <Route
              path="/owner"
              element={
                <RequireOwner>
                  <OwnerPage />
                </RequireOwner>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
