import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Navbar from '@/components/Navbar'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900">
      <Navbar />
      <Hero />
      <Features />
    </main>
  )
}
