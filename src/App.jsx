import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import IntakeNew from './pages/intake/IntakeNew'
import IntakeSession from './pages/intake/IntakeSession'
import ShopQrRedirect from './pages/intake/ShopQrRedirect'
import BriefResult from './pages/BriefResult'
import Account from './pages/Account'
import AccountBrief from './pages/AccountBrief'
import ShopLayout from './pages/shop/ShopLayout'
import OverviewTab from './pages/shop/OverviewTab'
import IntakesTab from './pages/shop/IntakesTab'
import IntakeDetail from './pages/shop/IntakeDetail'
import KitTab from './pages/shop/KitTab'
import TeamTab from './pages/shop/TeamTab'
import SettingsTab from './pages/shop/SettingsTab'
import ForShops from './pages/ForShops'
import AdminShops from './pages/admin/AdminShops'
import IntakeDebug from './pages/dev/IntakeDebug'
import ConsumerIntakesDebug from './pages/dev/ConsumerIntakesDebug'
import AnnotationTool from './pages/dev/AnnotationTool'

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-ink text-text">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/intake" element={<IntakeNew />} />
            <Route path="/intake/:id" element={<IntakeSession />} />
            <Route path="/brief/:id" element={<BriefResult />} />
            <Route path="/account" element={<Account />} />
            <Route path="/account/:id" element={<AccountBrief />} />
            <Route path="/i/:slug" element={<ShopQrRedirect />} />
            <Route path="/shop/:slug" element={<ShopLayout />}>
              <Route index element={<OverviewTab />} />
              <Route path="intakes" element={<IntakesTab />} />
              <Route path="intakes/:id" element={<IntakeDetail />} />
              <Route path="kit" element={<KitTab />} />
              <Route path="team" element={<TeamTab />} />
              <Route path="settings" element={<SettingsTab />} />
            </Route>
            <Route path="/for-shops" element={<ForShops />} />
            <Route path="/admin/shops" element={<AdminShops />} />
            <Route path="/dev/intake/:id" element={<IntakeDebug />} />
            <Route path="/dev/consumer-intakes" element={<ConsumerIntakesDebug />} />
            <Route path="/dev/annotate" element={<AnnotationTool />} />
          </Routes>
        </main>
        <footer className="border-t border-line/60 py-8 text-center text-xs text-text-mute">
          Greenlit — speak mechanic.
        </footer>
      </div>
    </AuthProvider>
  )
}

export default App
