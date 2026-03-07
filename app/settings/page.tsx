"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hapticEnabled, setHapticEnabled] = useState(true)
  const [autoDetection, setAutoDetection] = useState(true)

  return (
    <div className="px-5 pt-14 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Preferences</p>
      </motion.div>

      {/* Settings List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {/* Detection */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Detection</p>
          <div className="bg-card rounded-2xl border border-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Auto Detection</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatic score tracking
                </p>
              </div>
              <Switch
                checked={autoDetection}
                onCheckedChange={setAutoDetection}
              />
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Feedback</p>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Sound</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audio feedback
                </p>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Haptics</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vibration feedback
                </p>
              </div>
              <Switch
                checked={hapticEnabled}
                onCheckedChange={setHapticEnabled}
              />
            </div>
          </div>
        </div>

        {/* About */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">About</p>
          <div className="bg-card rounded-2xl border border-border">
            <div className="flex items-center justify-between p-4">
              <p className="text-sm font-medium">Version</p>
              <p className="text-sm text-muted-foreground">1.0.0</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
