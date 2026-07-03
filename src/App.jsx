import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import IntakeFlow from './pages/intake/IntakeFlow'
import BriefResult from './pages/BriefResult'
import ShopLanding from './pages/ShopLanding'
import ShopDashboard from './pages/ShopDashboard'

function App() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/intake" element={<IntakeFlow />} />
          <Route path="/brief/:id" element={<BriefResult />} />
          <Route path="/shop/:shopId" element={<ShopLanding />} />
          <Route path="/shop/:shopId/dashboard" element={<ShopDashboard />} />
        </Routes>
      </main>
      <footer className="border-t border-line/60 py-8 text-center text-xs text-white/30">
        Greenlit — speak mechanic. · Demo build, not for production use.
      </footer>
    </div>
  )
}

export default App
