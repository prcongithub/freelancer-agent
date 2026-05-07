import Header from './components/Header'
import Hero from './components/Hero'
import Problem from './components/Problem'
import Solution from './components/Solution'
import Features from './components/Features'
import SignalDemo from './components/SignalDemo'
import TwoSided from './components/TwoSided'
import UseCases from './components/UseCases'
import HowItWorks from './components/HowItWorks'
import Metrics from './components/Metrics'
import Pricing from './components/Pricing'
import Comparison from './components/Comparison'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Features />
        <SignalDemo />
        <TwoSided />
        <UseCases />
        <HowItWorks />
        <Metrics />
        <Pricing />
        <Comparison />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
