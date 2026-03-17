"use client"

import { useMemo, type ReactNode } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets"
import { clusterApiUrl } from "@solana/web3.js"

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const network = (
    process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? WalletAdapterNetwork.Devnet
  ) as WalletAdapterNetwork

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl(network),
    [network]
  )

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}
