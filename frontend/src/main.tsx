import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key in .env configuration file.")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      {/* 🔐 If the user is logged in, show the app */}
      <SignedIn>
        <App />
      </SignedIn>

      {/* 🚪 If the user is logged out, force them to sign in */}
      <SignedOut>
        <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4 font-sans">
          <RedirectToSignIn />
        </div>
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>,
)