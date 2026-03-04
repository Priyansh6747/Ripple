"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

function Navbar() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <Link href="/" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Ripple
      </Link>

      <div className="flex items-center gap-4">
        {isLoaded && isSignedIn && (
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-9 h-9",
              },
            }}
          />
        )}
        {isLoaded && !isSignedIn && (
          <>
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300 transition-colors"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-20 bg-zinc-50 dark:bg-black">
        <section className="flex flex-col items-center gap-6 text-center max-w-2xl">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl">
            Welcome to <span className="text-blue-600">Ripple</span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-md">
            Get started by editing this page. Build something amazing.
          </p>
        </section>
      </main>
    </>
  );
}
