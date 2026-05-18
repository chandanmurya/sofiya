'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// ─── Localization ────────────────────────────────────────────
const content = {
  en: {
    nav: { login: 'Login', getStarted: 'Get Started Free' },
    hero: {
      badge: 'AI-Powered Video Creator for India',
      title: 'Create Your Digital Twin.',
      titleAccent: 'Generate Videos on Autopilot.',
      subtitle: 'Upload a short video of yourself, clone your voice, and generate unlimited professional videos — in Hindi, English, or Hinglish.',
      cta: 'Start Creating Free',
      ctaSub: 'No credit card required • 60 seconds free',
    },
    steps: {
      title: 'How It Works',
      subtitle: '3 simple steps to your first AI video',
      items: [
        { num: '01', title: 'Upload & Train', desc: 'Record a 5-minute video. Our AI creates your Digital Twin avatar.' },
        { num: '02', title: 'Clone Your Voice', desc: 'Upload 1-3 minutes of clean audio. Your voice, replicated perfectly.' },
        { num: '03', title: 'Generate Videos', desc: 'Type a script, pick a format — get a studio-quality video in minutes.' },
      ],
    },
    useCases: {
      title: 'Built for Indian Creators',
      items: [
        { icon: '📱', title: 'Instagram Reels', desc: 'Create viral 9:16 reels in Hindi or Hinglish with your AI avatar.' },
        { icon: '🎓', title: 'Education Content', desc: 'Scale your course content. Record once, generate many.' },
        { icon: '🏢', title: 'Business Videos', desc: 'Product demos, customer onboarding, sales pitches — automated.' },
        { icon: '📢', title: 'Agencies', desc: 'Manage multiple avatars for multiple clients. Scale without limits.' },
      ],
    },
    pricing: {
      title: 'Simple Pricing. No Surprises.',
      subtitle: 'Start free. Upgrade when you need more.',
      plans: [
        { name: 'Starter', price: '₹199', period: '/month', seconds: '60s', features: ['60 seconds/month', '720p resolution', 'Script templates', 'Stock avatars', 'Background options'], cta: 'Start with Starter' },
        { name: 'Creator', price: '₹499', period: '/month', seconds: '3 min', features: ['180 seconds/month', '1080p resolution', '1 voice clone', 'Custom avatar (add-on)', 'Top-ups available'], cta: 'Go Creator', popular: true },
        { name: 'Studio', price: '₹999', period: '/month', seconds: '6 min', features: ['360 seconds/month', '1080p default', 'Priority queue', '2 voice clones', 'Transparent BG (WEBM)'], cta: 'Go Studio' },
      ],
      addon: 'Avatar Setup Add-on: ₹849 one-time',
    },
    faq: {
      title: 'Questions? We Got Answers.',
      items: [
        { q: 'What is a Digital Twin?', a: 'A Digital Twin is an AI avatar that looks and speaks like you. Train it once with a 5-minute video and generate unlimited videos.' },
        { q: 'Which languages are supported?', a: 'English, Hindi, and Hinglish. Perfect for the Indian creator ecosystem.' },
        { q: 'How long does avatar training take?', a: 'Usually 10-30 minutes after consent verification is completed.' },
        { q: 'What happens to my data?', a: 'Your videos and voice data are stored securely. You can request deletion anytime from Settings.' },
      ],
    },
    footer: {
      tagline: 'Made in India, for Indian Creators.',
      links: ['Privacy', 'Terms', 'Support'],
    },
  },
  hi: {
    nav: { login: 'लॉगिन', getStarted: 'मुफ्त शुरू करें' },
    hero: {
      badge: 'भारत के लिए AI वीडियो क्रिएटर',
      title: 'अपना डिजिटल ट्विन बनाएं।',
      titleAccent: 'ऑटोपायलट पर वीडियो जनरेट करें।',
      subtitle: 'अपनी एक छोटी वीडियो अपलोड करें, अपनी आवाज़ क्लोन करें, और असीमित प्रोफेशनल वीडियो बनाएं — हिंदी, इंग्लिश, या हिंगलिश में।',
      cta: 'मुफ्त शुरू करें',
      ctaSub: 'क्रेडिट कार्ड नहीं चाहिए • 60 सेकंड मुफ्त',
    },
    steps: {
      title: 'कैसे काम करता है',
      subtitle: 'अपनी पहली AI वीडियो तक 3 आसान स्टेप',
      items: [
        { num: '01', title: 'अपलोड & ट्रेन', desc: '5 मिनट की वीडियो रिकॉर्ड करें। हमारी AI आपका Digital Twin बनाएगी।' },
        { num: '02', title: 'वॉइस क्लोन करें', desc: '1-3 मिनट का क्लीन ऑडियो अपलोड करें। आपकी आवाज़, एकदम सही।' },
        { num: '03', title: 'वीडियो जनरेट करें', desc: 'स्क्रिप्ट टाइप करें, फॉर्मेट चुनें — मिनटों में स्टूडियो-क्वालिटी वीडियो।' },
      ],
    },
    useCases: {
      title: 'भारतीय क्रिएटर्स के लिए बना',
      items: [
        { icon: '📱', title: 'Instagram Reels', desc: 'अपने AI अवतार से हिंदी या हिंगलिश में वायरल 9:16 रील्स बनाएं।' },
        { icon: '🎓', title: 'एजुकेशन कंटेंट', desc: 'अपना कोर्स कंटेंट स्केल करें। एक बार रिकॉर्ड करें, कई बनाएं।' },
        { icon: '🏢', title: 'बिजनेस वीडियो', desc: 'प्रोडक्ट डेमो, कस्टमर ऑनबोर्डिंग, सेल्स पिच — ऑटोमेटेड।' },
        { icon: '📢', title: 'एजेंसीज', desc: 'मल्टीपल क्लाइंट्स के लिए मल्टीपल अवतार मैनेज करें।' },
      ],
    },
    pricing: {
      title: 'सीधी कीमत। कोई सरप्राइज नहीं।',
      subtitle: 'मुफ्त शुरू करें। जरूरत पड़े तो अपग्रेड करें।',
      plans: [
        { name: 'स्टार्टर', price: '₹199', period: '/महीना', seconds: '60s', features: ['60 सेकंड/महीना', '720p रिज़ॉल्यूशन', 'स्क्रिप्ट टेम्पलेट', 'स्टॉक अवतार', 'बैकग्राउंड ऑप्शन'], cta: 'स्टार्टर शुरू करें' },
        { name: 'क्रिएटर', price: '₹499', period: '/महीना', seconds: '3 मिनट', features: ['180 सेकंड/महीना', '1080p रिज़ॉल्यूशन', '1 वॉइस क्लोन', 'कस्टम अवतार (add-on)', 'टॉप-अप उपलब्ध'], cta: 'क्रिएटर बनें', popular: true },
        { name: 'स्टूडियो', price: '₹999', period: '/महीना', seconds: '6 मिनट', features: ['360 सेकंड/महीना', '1080p डिफ़ॉल्ट', 'प्रायॉरिटी क्यू', '2 वॉइस क्लोन', 'ट्रांसपेरेंट BG (WEBM)'], cta: 'स्टूडियो बनें' },
      ],
      addon: 'अवतार सेटअप Add-on: ₹849 एक बार',
    },
    faq: {
      title: 'सवाल? हमारे पास जवाब हैं।',
      items: [
        { q: 'Digital Twin क्या है?', a: 'Digital Twin एक AI अवतार है जो आपकी तरह दिखता और बोलता है। एक बार 5 मिनट की वीडियो से ट्रेन करें और असीमित वीडियो जनरेट करें।' },
        { q: 'कौन सी भाषाएं सपोर्ट हैं?', a: 'English, Hindi, और Hinglish। भारतीय क्रिएटर इकोसिस्टम के लिए परफेक्ट।' },
        { q: 'अवतार ट्रेनिंग में कितना समय लगता है?', a: 'कंसेंट वेरिफिकेशन के बाद आमतौर पर 10-30 मिनट।' },
        { q: 'मेरा डेटा क्या होगा?', a: 'आपकी वीडियो और वॉइस डेटा सुरक्षित स्टोर होता है। आप कभी भी Settings से डिलीशन रिक्वेस्ट कर सकते हैं।' },
      ],
    },
    footer: {
      tagline: 'भारत में बना, भारतीय क्रिएटर्स के लिए।',
      links: ['प्राइवेसी', 'टर्म्स', 'सपोर्ट'],
    },
  },
};

export default function LandingPage() {
  const [locale, setLocale] = useState<'en' | 'hi'>('en');
  const t = content[locale];

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-dark-900/80 backdrop-blur-xl border-b border-dark-400/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">AF</span>
            </div>
            <span className="text-lg font-bold text-white">AvatarForge</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
              className="text-xs px-2.5 py-1 rounded-md border border-dark-400/40 text-dark-100 hover:text-white hover:border-dark-300 transition-colors"
            >
              {locale === 'en' ? 'हिंदी' : 'ENG'}
            </button>

            <Link href="/login" className="text-sm text-dark-100 hover:text-white transition-colors">
              {t.nav.login}
            </Link>
            <Link href="/login">
              <Button size="sm">{t.nav.getStarted}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            {t.hero.badge}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            {t.hero.title}
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              {t.hero.titleAccent}
            </span>
          </h1>

          <p className="text-lg text-dark-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col items-center gap-3">
            <Link href="/login">
              <Button size="lg">{t.hero.cta}</Button>
            </Link>
            <p className="text-xs text-dark-300">{t.hero.ctaSub}</p>
          </div>

          {/* Hero Visual Placeholder */}
          <div className="mt-16 relative">
            <div className="aspect-video max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-dark-700/80 to-dark-800/80 border border-dark-400/20 overflow-hidden flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="text-6xl">🧬</div>
                <p className="text-sm text-dark-200">Video generation preview</p>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-600/10 via-transparent to-brand-600/10 blur-3xl -z-10 rounded-3xl" />
          </div>
        </div>
      </section>

      {/* ─── How It Works ──────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-dark-400/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-2">{t.steps.title}</h2>
            <p className="text-dark-100">{t.steps.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.steps.items.map((step, i) => (
              <Card key={i} hover className="relative overflow-hidden">
                <div className="absolute top-4 right-4 text-4xl font-bold text-dark-500/30">
                  {step.num}
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm mb-4">
                    {step.num}
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-dark-100 leading-relaxed">{step.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases ─────────────────────────────────────── */}
      <section className="py-20 px-4 bg-dark-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">{t.useCases.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.useCases.items.map((item, i) => (
              <Card key={i} hover padding="md">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-white font-medium mb-1">{item.title}</h3>
                <p className="text-xs text-dark-200 leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ───────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-dark-400/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-2">{t.pricing.title}</h2>
            <p className="text-dark-100">{t.pricing.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {t.pricing.plans.map((plan: any, i: number) => (
              <Card
                key={i}
                glow={plan.popular}
                className={`relative flex flex-col ${plan.popular ? 'scale-[1.02] border-brand-500/40' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-brand-600 text-white text-[10px] font-semibold px-3 py-1 rounded-full shadow-lg shadow-brand-600/30 uppercase tracking-wider">
                      Popular
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-dark-200 text-sm">{plan.period}</span>
                  </div>
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded text-xs text-brand-400 font-medium">
                    {plan.seconds} included
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-dark-100">
                      <span className="text-green-400 text-xs mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/login">
                  <Button variant={plan.popular ? 'primary' : 'secondary'} className="w-full">
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-dark-200">{t.pricing.addon}</p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-dark-800/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">{t.faq.title}</h2>
          <div className="space-y-3">
            {t.faq.items.map((item, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between cursor-pointer p-4 rounded-xl bg-dark-700/40 border border-dark-400/20 hover:border-dark-400/40 transition-colors">
                  <span className="text-sm font-medium text-white pr-4">{item.q}</span>
                  <span className="text-dark-200 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-4 pb-4 pt-2">
                  <p className="text-sm text-dark-100 leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────── */}
      <footer className="py-10 px-4 border-t border-dark-400/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-brand-500 to-brand-700 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-[8px]">AF</span>
            </div>
            <span className="text-sm text-dark-200">{t.footer.tagline}</span>
          </div>
          <div className="flex items-center gap-4">
            {t.footer.links.map((link, i) => (
              <a key={i} href="#" className="text-xs text-dark-300 hover:text-dark-100 transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
