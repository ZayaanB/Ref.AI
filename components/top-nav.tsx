"use client"

import Link from "next/link"
import { MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-full max-w-md mx-auto px-5">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Ref<span className="text-primary">AI</span>
        </span>
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </header>
  )
}
