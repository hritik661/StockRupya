"use client"

export function LegalFooter() {
  return (
    <footer className="w-full bg-black border-t-4 border-green-500 py-8 px-4 mt-16">
      <div className="max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-amber-400 text-2xl">⚠️</span>
          <p className="text-lg md:text-xl text-green-400 font-extrabold uppercase tracking-wider">
            Educational & Practice Only
          </p>
        </div>
        <p className="text-sm md:text-base text-gray-300 mt-3 max-w-2xl mx-auto leading-relaxed">
          This platform is for education and practice only. <span className="text-green-400 font-bold">Not investment advice.</span>
        </p>
      </div>
    </footer>
  )
}
