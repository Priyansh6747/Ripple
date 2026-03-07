"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Globe,
  Layers,
  ArrowRight,
  Code2,
  Box,
  Workflow,
  BrainCircuit,
} from "lucide-react";

/* ─── Navbar ─────────────────────────────────────────────── */

function Navbar() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-white/70 backdrop-blur-xl border-b border-zinc-200/60">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-zinc-900 flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        Ripple
      </Link>

      <div className="hidden sm:flex items-center gap-8 text-sm text-zinc-500">
        <Link href="#features" className="hover:text-zinc-900 transition-colors">
          Features
        </Link>
        <Link href="#how-it-works" className="hover:text-zinc-900 transition-colors">
          How It Works
        </Link>
        <Link href="#vision" className="hover:text-zinc-900 transition-colors">
          Vision
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {isLoaded && isSignedIn && (
          <>
            <Link
              href="/build"
              className="px-4 py-2 text-sm font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            >
              Open Builder
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{ elements: { avatarBox: "w-8 h-8" } }}
            />
          </>
        )}
        {isLoaded && !isSignedIn && (
          <>
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-36 pb-24 px-6 overflow-hidden bg-[#fafaf9]">
      {/* subtle grid bg */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-200 bg-white text-xs font-medium text-zinc-500 mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Software Creation Engine
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-zinc-900 leading-[0.95]">
            Describe it.
            <br />
            <span className="text-zinc-400">Build it.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-500 max-w-xl mx-auto leading-relaxed">
            Turn natural language into running web applications.
            No setup. No IDE. Just a prompt and a live preview.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/build"
              className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-all duration-300 shadow-lg shadow-zinc-900/20"
            >
              Start Building
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-all duration-300"
            >
              See How It Works
            </Link>
          </div>
        </motion.div>

        {/* Prompt preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-zinc-400 ml-2 font-mono">
                ripple
              </span>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 font-mono text-sm text-zinc-600 text-left">
              <span className="text-zinc-400">{">"}</span>{" "}
              build a marketplace for indie game assets with auth,
              dashboard, checkout, and admin panel
              <span className="inline-block w-2 h-4 bg-zinc-900 ml-1 animate-pulse" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Logos / Tech bar ───────────────────────────────────── */

function TechBar() {
  const techs = [
    { name: "Next.js", icon: Globe },
    { name: "Gemini AI", icon: BrainCircuit },
    { name: "E2B Sandbox", icon: Box },
    { name: "Inngest", icon: Workflow },
  ];

  return (
    <section className="py-12 border-y border-zinc-200 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-center text-xs font-medium text-zinc-400 uppercase tracking-widest mb-6">
          Powered By
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10">
          {techs.map(({ name, icon: Icon }) => (
            <div key={name} className="flex items-center gap-2 text-zinc-400">
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ───────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Intent-First Architecture",
    description:
      "Ripple understands your goal before building. It plans structure, components, and layout from your intent.",
  },
  {
    icon: Code2,
    title: "AI Coding Engine",
    description:
      "Gemini-powered agents plan, write, and iterate on production-quality code autonomously.",
  },
  {
    icon: Box,
    title: "Instant Sandbox",
    description:
      "Every project spins up in an isolated E2B sandbox with a live dev server. No local setup needed.",
  },
  {
    icon: Zap,
    title: "Live Preview",
    description:
      "Get a working URL in minutes. Watch your app come to life as the AI builds it in real time.",
  },
  {
    icon: Workflow,
    title: "Durable Workflows",
    description:
      "Inngest orchestrates the entire pipeline — from sandbox creation to code generation to preview.",
  },
  {
    icon: Layers,
    title: "Full-Stack Output",
    description:
      "Not just a landing page. Auth, dashboards, APIs — Ripple builds complete applications.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-6 bg-[#fafaf9]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900">
            Everything You Need to Ship
          </h2>
          <p className="mt-4 text-zinc-500 text-lg max-w-lg mx-auto">
            From prompt to production. One engine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group rounded-2xl border border-zinc-200 bg-white p-7 hover:shadow-lg hover:shadow-zinc-200/50 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-5 group-hover:bg-zinc-900 transition-colors duration-300">
                <f.icon className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ───────────────────────────────────────── */

const STEPS = [
  {
    number: "01",
    title: "Describe Your App",
    description: "Type what you want in plain English. Be as detailed or as vague as you like.",
  },
  {
    number: "02",
    title: "AI Plans & Builds",
    description:
      "A planner agent architects the UI. A coder agent writes every file. All inside a live sandbox.",
  },
  {
    number: "03",
    title: "Get a Live Preview",
    description: "Within minutes you have a running app with a public URL. Edit, iterate, deploy.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900">
            How It Works
          </h2>
          <p className="mt-4 text-zinc-500 text-lg max-w-md mx-auto">
            Three steps from idea to running application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="relative"
            >
              <span className="text-6xl font-bold text-zinc-100">{s.number}</span>
              <h3 className="mt-2 text-lg font-semibold text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                {s.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Vision CTA ─────────────────────────────────────────── */

function VisionCTA() {
  return (
    <section id="vision" className="py-24 px-6 bg-zinc-900">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Software should be generated
            <br />
            as easily as writing a paragraph.
          </h2>
          <p className="mt-6 text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            Ripple is building the future where ideas become products in minutes, not months.
          </p>
          <div className="mt-10">
            <Link
              href="/build"
              className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold rounded-full bg-white text-zinc-900 hover:bg-zinc-100 transition-all duration-300 shadow-lg"
            >
              Start Building Now
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Sparkles className="w-4 h-4" />
          <span>Ripple</span>
        </div>
        <p className="text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} Ripple. Prompt → Code → Running App.
        </p>
      </div>
    </footer>
  );
}

/* ─── Page ────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TechBar />
        <Features />
        <HowItWorks />
        <VisionCTA />
      </main>
      <Footer />
    </>
  );
}
