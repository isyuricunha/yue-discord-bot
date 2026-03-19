import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './store/auth'
import LoginPage from './pages/Login'
import TokenLoginPage from './pages/TokenLogin'
import ExtrasPage from './pages/Extras'
import ExtrasHomePage from './pages/extras/ExtrasHome'
import ExtrasAboutPage from './pages/extras/ExtrasAbout'
import ExtrasModerationPage from './pages/extras/ExtrasModeration'
import ExtrasCommandsPage from './pages/extras/ExtrasCommands'
import ExtrasPlaceholdersPage from './pages/extras/ExtrasPlaceholders'
import ExtrasBanAppealPage from './pages/extras/ExtrasBanAppeal'
import TermsPage from './pages/Terms'
import PrivacyPage from './pages/Privacy'
import DashboardPage from './pages/Dashboard'
import GuildPage from './pages/Guild'
import OverviewPage from './pages/Overview'
import ModLogsPage from './pages/ModLogs'
import AuditLogsPage from './pages/AuditLogs'
import CommandsPage from './pages/Commands'
import MembersPage from './pages/Members'
import MemberDetailsPage from './pages/MemberDetails'
import GiveawaysPage from './pages/Giveaways'
import GiveawayDetailsPage from './pages/GiveawayDetails'
import CreateGiveawayPage from './pages/CreateGiveaway'
import GiveawayEntryEditPage from './pages/GiveawayEntryEdit'
import SettingsPage from './pages/Settings'
import ModerationPage from './pages/Moderation'
import AntiRaidPage from './pages/AntiRaid'
import WelcomePage from './pages/Welcome'
import XpLevelsPage from './pages/XpLevels'
import AutorolePage from './pages/Autorole'
import TicketsPage from './pages/Tickets'
import SetupWizardPage from './pages/SetupWizard'
import SuggestionsPage from './pages/Suggestions'
import ReactionRolesPage from './pages/ReactionRoles'
import StarboardPage from './pages/Starboard'
import BadgesPage from './pages/Badges'
import FanArtsPage from './pages/FanArts'
import EconomyPage from './pages/Economy'
import CoinflipPage from './pages/Coinflip'
import OwnerPage from './pages/Owner'
import MusicPage from './pages/Music'
import CustomCommandsPage from './pages/CustomCommands'
import { AppShell, PublicShell, RequireAuth, RequireOwner } from './components/layout'
import { getApiUrl } from './env'
import axios from 'axios'

function App() {
  const { user, isLoading, initialize } = useAuthStore()

  const isDevelopment = import.meta.env.DEV
  const allowTokenLogin = isDevelopment
  const [isProcessingUrlToken, setIsProcessingUrlToken] = useState(false)

  const isAuthenticated = Boolean(user)
  const isAuthResolved = !isLoading

  useEffect(() => {
    // In development mode, check for token in URL and securely store it in cookie
    if (allowTokenLogin) {
      const params = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')

      if (urlToken) {
        setIsProcessingUrlToken(true)
        // Show security warning in development
        console.warn(
          '[Security Warning] Token detected in URL. This is insecure for production. ' +
          'The token will be stored in an httpOnly cookie and removed from the URL.'
        )

        // Send token to API to store in httpOnly cookie
        axios
          .post(
            `${getApiUrl()}/api/auth/set-token-cookie`,
            { token: urlToken },
            { withCredentials: true }
          )
          .then(() => {
            // Clean up URL - remove token parameter
            window.history.replaceState({}, '', window.location.pathname)
            // Reload the page to let the auth store initialize with the cookie
            window.location.reload()
          })
          .catch((err) => {
            console.error('[Security] Failed to store token in cookie:', err)
            // Still clean up URL even if it fails
            window.history.replaceState({}, '', window.location.pathname)
            setIsProcessingUrlToken(false)
          })

        return
      }
    }

    // In production or if no token in URL, just initialize normally
    initialize()
  }, [])

  // Show loading while processing URL token
  if (isProcessingUrlToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Processing secure login...</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Storing token in secure cookie
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!isAuthResolved || !isAuthenticated ? <LoginPage /> : <Navigate to="/" />}
        />
        {allowTokenLogin && <Route path="/token-login" element={<TokenLoginPage />} />}

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
          <Route path="/guild/:guildId/automod" element={<Navigate to="../moderation" replace />} />
          <Route path="/guild/:guildId/antiraid" element={<AntiRaidPage />} />
          <Route path="/guild/:guildId/modlogs" element={<ModLogsPage />} />
          <Route path="/guild/:guildId/music" element={<MusicPage />} />
          <Route path="/guild/:guildId/custom-commands" element={<CustomCommandsPage />} />
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
          <Route path="/guild/:guildId/music" element={<MusicPage />} />
          <Route path="/guild/:guildId/suggestions" element={<SuggestionsPage />} />
          <Route path="/guild/:guildId/reaction-roles" element={<ReactionRolesPage />} />
          <Route path="/guild/:guildId/starboard" element={<StarboardPage />} />
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
  )
}

export default App
