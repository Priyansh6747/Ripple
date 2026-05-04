// lib/rippleConfigSchema.js
// ─── RIPPLE CONFIG SCHEMA ────────────────────────────────────────────────────
// Single source of truth for what the generation engine produces.
// ALL fields are required. Constraints are enforced by validateAndSanitise().

export const RIPPLE_CONFIG_SCHEMA = {

  // ── BRAND ──────────────────────────────────────────────────────────────────
  brand: {
    siteName: "STRING — 1-2 words, memorable, PascalCase or title case",
    siteTagline: "STRING — max 6 words, punchy, no period",
  },

  // ── BRAND COLORS ───────────────────────────────────────────────────────────
  // Only these values change in Color.js. All other color tokens stay as-is.
  brandColors: {
    light: {
      primary:  "HEX — main brand color, works on white bg",
      hover:    "HEX — ~10% darker than primary",
      active:   "HEX — ~20% darker than primary",
      soft:     "HEX — very light tint of primary (8% opacity feel)",
      subtle:   "HEX — even lighter tint (4% opacity feel)",
      accent:   "HEX — same as primary or a complementary accent",
    },
    dark: {
      primary:  "HEX — lighter version of brand for dark backgrounds (~15% lighter)",
      hover:    "HEX — ~10% darker than dark.primary",
      active:   "HEX — ~20% darker than dark.primary",
      soft:     "HEX — very dark tinted surface (#1F___)",
      subtle:   "HEX — slightly lighter dark tint (#26___)",
      accent:   "HEX — same as dark.primary",
    },
  },

  // ── NAV ────────────────────────────────────────────────────────────────────
  nav: {
    links: [
      // 3 items exactly
      { label: "STRING", href: "STRING — #anchor or /path" },
    ],
    cta:       "STRING — button label, action verb, max 3 words",
    ctaHref:   "/signup",
    login:     "STRING — e.g. 'Sign In'",
    loginHref: "/login",
  },

  // ── HERO (HeroSection.jsx — reads from UIText) ─────────────────────────────
  hero: {
    badge:            "STRING — short announcement, e.g. 'Now in Public Beta'",
    title:            "STRING — 3-5 words, ends WITHOUT period (accent continues it)",
    titleAccent:      "STRING — 2-3 words that complete the title, gets colored",
    subtitle:         "STRING — 1-2 sentences, benefit-led, max 25 words",
    ctaPrimary:       "STRING — e.g. 'Get Started Free'",
    ctaPrimaryHref:   "/signup",
    ctaSecondary:     "STRING — e.g. 'See Demo'",
    ctaSecondaryHref: "#product-demo",
    socialProof:      "STRING — e.g. 'Trusted by 2,000+ teams worldwide'",
  },

  // ── AURORA HERO (AuroraHero.jsx local UI) ──────────────────────────────────
  // Full-screen animated hero on app/page.js
  auroraHero: {
    badge:       "STRING — version/status badge, e.g. 'v2.0 Beta Now Live'",
    headline:    "STRING — 4-7 words, bold statement, no period",
    subheadline: "STRING — 2 sentences, max 30 words, what it does + why it matters",
    ctaText:     "STRING — e.g. 'Start Building Free'",
    ctaHref:     "/signup",
  },

  // ── FEATURES SECTION (FeaturesSection + UIText) ───────────────────────────
  features: {
    badge:       "STRING — e.g. 'Features'",
    title:       "STRING — 4-5 words, ends without period",
    titleAccent: "STRING — 2-3 words completing the title",
    subtitle:    "STRING — 1 sentence, max 15 words",
    items: [
      // EXACTLY 6 items. Icon MUST be one of:
      // Zap | Shield | BarChart3 | Layers | Globe | Sparkles | Code | Lock | Users | Rocket | Star | Heart
      {
        icon:        "STRING — lucide-react icon name from allowed list",
        title:       "STRING — 2-3 words",
        description: "STRING — 1-2 sentences, max 20 words, specific benefit",
      },
    ],
  },

  // ── BOUNCY CARDS (BouncyCard.jsx local UI — visual feature showcase) ───────
  bouncyCards: {
    title:       "STRING — 2-3 words, e.g. 'Powerful tools'",
    titleAccent: "STRING — 3-4 words completing it, e.g. 'for modern teams.'",
    cta:         "STRING — link label, e.g. 'Explore the docs'",
    ctaHref:     "/features",
    cards: [
      // EXACTLY 4 cards. Spans are FIXED — do not change them.
      // Card 0: span = "col-span-12 md:col-span-4"
      // Card 1: span = "col-span-12 md:col-span-8"
      // Card 2: span = "col-span-12 md:col-span-8"
      // Card 3: span = "col-span-12 md:col-span-4"
      {
        title:         "STRING — feature name, 2-4 words",
        demoLabel:     "STRING — stat or keyword shown on hover, e.g. '99ms' or 'git push'",
        gradientFrom:  "STRING — Tailwind class e.g. 'from-blue-500'",
        gradientTo:    "STRING — Tailwind class e.g. 'to-cyan-400'",
        demoTextColor: "text-white",
        span:          "STRING — FIXED VALUE, see above",
      },
    ],
  },

  // ── PRODUCT DEMO SECTION (UIText) ─────────────────────────────────────────
  productDemo: {
    badge:    "STRING — e.g. 'Product'",
    title:    "STRING — e.g. 'See it in action'",
    subtitle: "STRING — 1 sentence describing the demo",
    tabs: [
      // 3 tabs exactly
      { label: "STRING", value: "STRING — lowercase-hyphenated" },
    ],
  },

  // ── TESTIMONIALS (UIText + MarqueeDemo local UI) ──────────────────────────
  testimonials: {
    badge:       "STRING — e.g. 'Testimonials'",
    title:       "STRING — 3 words",
    titleAccent: "STRING — 1-2 words",
    subtitle:    "STRING — 1 sentence",
    reviews: [
      // EXACTLY 8 reviews. img: "https://avatar.vercel.sh/<firstname_lowercase>"
      {
        name:     "STRING — First Last",
        username: "STRING — @handle",
        role:     "STRING — e.g. 'CTO at Nexus'",
        body:     "STRING — 1-2 sentences, specific and credible, max 20 words",
        img:      "STRING — https://avatar.vercel.sh/<firstname>",
      },
    ],
  },

  // ── MARQUEE REVIEWS (MarqueeDemo.jsx local UI) ─────────────────────────────
  // Scrolling marquee on app/page.js and app/product/page.js
  marqueeReviews: [
    // EXACTLY 6 reviews. DIFFERENT people from testimonials.reviews.
    // img: "https://avatar.vercel.sh/<firstname_lowercase>"
    {
      name:     "STRING",
      username: "STRING — @handle",
      body:     "STRING — short, punchy, 1 sentence max 15 words",
      img:      "STRING — https://avatar.vercel.sh/<firstname>",
    },
  ],

  // ── PRICING (UIText.pricing + app/pricing/page.js local UI) ───────────────
  pricing: {
    badge:          "STRING",
    title:          "STRING — 3-4 words",
    titleAccent:    "STRING — 1 word e.g. 'pricing'",
    subtitle:       "STRING — 1 sentence, reassuring, mentions free tier",
    plans: [
      // EXACTLY 3 plans. Middle plan has popular: true. Others: popular: false.
      {
        name:        "STRING — e.g. 'Starter'",
        price:       "STRING — e.g. '$0' or '$29'",
        period:      "STRING — '/month' or '' for custom",
        description: "STRING — 1 sentence, who it's for",
        features:    ["STRING", "STRING", "STRING", "STRING"],
        cta:         "STRING — e.g. 'Start Free'",
        popular:     "BOOLEAN",
      },
    ],
    // For app/pricing/page.js local UI
    launchHeader:    "STRING — urgency headline e.g. 'Early Access Pricing.'",
    launchSub:       "STRING — 1 sentence supporting the urgency",
    pricingTitle:    "STRING — e.g. 'Simple, transparent pricing'",
    pricingSubtitle: "STRING — 1 sentence, no hidden fees messaging",
  },

  // ── FAQ (UIText) ──────────────────────────────────────────────────────────
  faq: {
    badge:       "STRING — 'FAQ'",
    title:       "STRING — e.g. 'Frequently asked'",
    titleAccent: "STRING — e.g. 'questions'",
    items: [
      // EXACTLY 5 items
      {
        q: "STRING — question, ends with '?'",
        a: "STRING — answer, 1-2 sentences, specific and reassuring",
      },
    ],
  },

  // ── CTA SECTION (UIText) ──────────────────────────────────────────────────
  cta: {
    title:            "STRING — e.g. 'Ready to get started?'",
    subtitle:         "STRING — 1 sentence, includes social proof number",
    ctaPrimary:       "STRING — e.g. 'Create Free Account'",
    ctaPrimaryHref:   "/signup",
    ctaSecondary:     "STRING — e.g. 'Talk to Sales'",
    ctaSecondaryHref: "#",
  },

  // ── FOOTER (UIText) ───────────────────────────────────────────────────────
  footer: {
    brand:     "STRING — same as brand.siteName",
    tagline:   "STRING — same as brand.siteTagline",
    copyright: "STRING — e.g. '© 2026 AppName. All rights reserved.'",
    groups: [
      // EXACTLY 3 groups, 3 links each
      {
        title: "STRING",
        links: [{ label: "STRING", href: "STRING" }],
      },
    ],
  },

  // ── AUTH (UIText) ─────────────────────────────────────────────────────────
  auth: {
    login: {
      title:               "STRING — e.g. 'Welcome back'",
      subtitle:            "STRING — 1 sentence",
      emailLabel:          "Email",
      emailPlaceholder:    "you@example.com",
      passwordLabel:       "Password",
      passwordPlaceholder: "••••••••",
      submit:              "STRING — e.g. 'Sign In'",
      forgotPassword:      "Forgot password?",
      switchText:          "STRING",
      switchLink:          "STRING",
      switchHref:          "/signup",
      divider:             "or",
      socialGoogle:        "Continue with Google",
      socialGithub:        "Continue with GitHub",
    },
    signup: {
      title:               "STRING — e.g. 'Create your account'",
      subtitle:            "STRING — 1 sentence, low friction",
      nameLabel:           "Full Name",
      namePlaceholder:     "Jane Doe",
      emailLabel:          "Email",
      emailPlaceholder:    "you@example.com",
      passwordLabel:       "Password",
      passwordPlaceholder: "••••••••",
      submit:              "STRING — e.g. 'Create Account'",
      switchText:          "STRING",
      switchLink:          "STRING",
      switchHref:          "/login",
      divider:             "or",
      socialGoogle:        "Continue with Google",
      socialGithub:        "Continue with GitHub",
    },
  },

  // ── DASHBOARD (UIText) ────────────────────────────────────────────────────
  dashboard: {
    sidebarTitle: "STRING — same as brand.siteName",
    sidebarNav: [
      // EXACTLY 5 items. FIXED icons: LayoutDashboard | BarChart3 | FolderKanban | Users | Settings
      { label: "STRING", icon: "STRING", href: "STRING" },
    ],
    headerTitle:    "STRING — e.g. 'Overview'",
    headerSubtitle: "STRING — welcome message",
    stats: [
      // EXACTLY 4 stats
      { label: "STRING", value: "STRING", change: "STRING — e.g. '+20.1%'", trend: "up|down" },
    ],
    chartTitle: "STRING",
    chartData: [
      // EXACTLY 7 months, realistic revenue arc
      { month: "STRING — e.g. 'Jan'", revenue: "NUMBER" },
    ],
    recentTitle: "STRING",
    recentItems: [
      // EXACTLY 5 items
      { name: "STRING", email: "STRING", amount: "STRING — e.g. '+$249.00'", status: "Completed|Pending|Processing" },
    ],
  },

  // ── FEATURES PAGE (app/features/page.js local UI) ─────────────────────────
  featuresPage: {
    headerTitle:      "STRING — e.g. 'Product Features'",
    headerSubtitle:   "STRING — 1 sentence tagline for the page",
    developerTitle:   "STRING — 4-6 words about DX",
    developerDesc:    "STRING — 2-3 sentences about developer experience",
    integrationTitle: "STRING — e.g. 'Ecosystem Integration'",
    integrationDesc:  "STRING — 2-3 sentences about integrations",
  },

  // ── PRODUCT PAGE (app/product/page.js local UI) ───────────────────────────
  productPage: {
    launchHeader: "STRING — e.g. 'AppName is dropping soon.'",
    launchSub:    "STRING — 1 sentence urgency + early access",
  },

  // ── HOME PAGE (app/page.js local UI) ──────────────────────────────────────
  homePage: {
    socialProofTitle:    "STRING — e.g. 'Trusted by the best teams'",
    socialProofSubtitle: "STRING — 1 sentence, invites to read reviews",
    ctaTitle:            "STRING — e.g. 'Ready to transform your workflow?'",
    ctaSubtitle:         "STRING — 1 sentence, community/scale reference",
    ctaPrimary:          "STRING",
    ctaPrimaryHref:      "/signup",
    ctaSecondary:        "STRING",
    ctaSecondaryHref:    "/docs",
  },
};

// ─── SCHEMA PROMPT ────────────────────────────────────────────────────────────
// Injected into the config agent system prompt so the model knows the exact shape.
export const SCHEMA_PROMPT = JSON.stringify(RIPPLE_CONFIG_SCHEMA, null, 2);
