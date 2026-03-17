"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Home, Clock, Settings } from "lucide-react"

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/history", icon: Clock, label: "History" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around h-20 max-w-md mx-auto px-6 pb-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
            >
              <motion.div
                className="flex flex-col items-center gap-1"
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`text-xs font-medium transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
