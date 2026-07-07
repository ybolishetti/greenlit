import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import IntakeNew from './pages/intake/IntakeNew'
import IntakeSession from './pages/intake/IntakeSession'
import BriefResult from './pages/BriefResult'
import Account from './pages/Account'
import AccountBrief from './pages/AccountBrief'
import ShopLanding from './pages/ShopLanding'
import ShopDashboard from './pages/ShopDashboard'
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
            <Route path="/shop/:shopId" element={<ShopLanding />} />
            <Route path="/shop/:shopId/dashboard" element={<ShopDashboard />} />
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
