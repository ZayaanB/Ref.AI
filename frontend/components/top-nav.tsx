"use client"

import Link from "next/link"
import { MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@solana/wallet-adapter-react"

function shortenAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function TopNav() {
  const { publicKey, connected } = useWallet()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-full max-w-md mx-auto px-5">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Ref<span className="text-primary">AI</span>
        </span>
        <div className="flex items-center gap-2">
          {connected && publicKey && (
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
              {shortenAddr(publicKey.toBase58())}
            </span>
          )}
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

