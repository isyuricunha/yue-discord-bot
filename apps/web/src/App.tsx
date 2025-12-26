import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/auth'
import LoginPage from './pages/Login'
import TokenLoginPage from './pages/TokenLogin'
import DashboardPage from './pages/Dashboard'
import GuildPage from './pages/Guild'
import OverviewPage from './pages/Overview'
import AutoModPage from './pages/AutoMod'
import ModLogsPage from './pages/ModLogs'
import MembersPage from './pages/Members'
import MemberDetailsPage from './pages/MemberDetails'
import GiveawaysPage from './pages/Giveaways'
import GiveawayDetailsPage from './pages/GiveawayDetails'
import CreateGiveawayPage from './pages/CreateGiveaway'
import SettingsPage from './pages/Settings'
import XpLevelsPage from './pages/XpLevels'
import AutorolePage from './pages/Autorole'
import BadgesPage from './pages/Badges'
import FanArtsPage from './pages/FanArts'
import { AppShell, RequireAuth } from './components/layout'

function App() {
  const { user, isLoading, setToken, initialize } = useAuthStore()

  const allow_token_login = import.meta.env.DEV

  const isAuthenticated = Boolean(user)

  useEffect(() => {
    if (allow_token_login) {
      const params = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')

      if (urlToken) {
        setToken(urlToken)
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
    }

    initialize()
  }, [])

  if (isLoading && !user) {
    return null
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        {allow_token_login && <Route path="/token-login" element={<TokenLoginPage />} />}

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/guild/:guildId" element={<GuildPage />} />
          <Route path="/guild/:guildId/overview" element={<OverviewPage />} />
          <Route path="/guild/:guildId/automod" element={<AutoModPage />} />
          <Route path="/guild/:guildId/modlogs" element={<ModLogsPage />} />
          <Route path="/guild/:guildId/members" element={<MembersPage />} />
          <Route path="/guild/:guildId/members/:userId" element={<MemberDetailsPage />} />
          <Route path="/guild/:guildId/giveaways" element={<GiveawaysPage />} />
          <Route path="/guild/:guildId/giveaways/create" element={<CreateGiveawayPage />} />
          <Route path="/guild/:guildId/giveaways/:giveawayId" element={<GiveawayDetailsPage />} />
          <Route path="/guild/:guildId/xp" element={<XpLevelsPage />} />
          <Route path="/guild/:guildId/autorole" element={<AutorolePage />} />
          <Route path="/guild/:guildId/settings" element={<SettingsPage />} />
          <Route path="/badges" element={<BadgesPage />} />
          <Route path="/fanarts" element={<FanArtsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
