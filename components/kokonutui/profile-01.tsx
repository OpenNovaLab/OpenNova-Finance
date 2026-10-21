"use client"

import React, { useState } from "react"
import { LogOut, MoveUpRight, Settings, CreditCard, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"

interface MenuItem {
  label: string
  value?: string
  href: string
  icon?: React.ReactNode
  external?: boolean
}

interface Profile01Props {
  name: string
  role: string
  avatar: string
  subscription?: string
}

const defaultProfile = {
  name: "Alex Morgan",
  role: "Portfolio Manager",
  avatar: "https://ferf1mheo22r9ira.public.blob.vercel-storage.com/avatar-02-albo9B0tWOSLXCVZh9rX9KFxXIVWMr.png",
  subscription: "Premium Plan",
} satisfies Required<Profile01Props>

export default function Profile01({
  name = defaultProfile.name,
  role = defaultProfile.role,
  avatar = defaultProfile.avatar,
  subscription = defaultProfile.subscription,
}: Partial<Profile01Props> = defaultProfile) {
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [pushAlerts, setPushAlerts] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState(true)
  const [twoFactor, setTwoFactor] = useState(true)
  const [currency, setCurrency] = useState("USD")
  const [language, setLanguage] = useState("en")
  const [timezone, setTimezone] = useState("GMT")

  const menuItems: MenuItem[] = [
    {
      label: "Subscription",
      value: subscription,
      href: "#",
      icon: <CreditCard className="w-4 h-4" />,
      external: false,
    },
    {
      label: "Terms & Policies",
      href: "#",
      icon: <FileText className="w-4 h-4" />,
      external: true,
    },
  ]

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="fx-panel">
        <div className="relative px-6 pt-12 pb-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative shrink-0">
              <Image
                src={avatar || "/placeholder.svg"}
                alt={name}
                width={72}
                height={72}
                className="rounded-full ring-4 ring-background object-cover"
              />
              <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-primary ring-2 ring-background" />
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground">{name}</h2>
              <p className="text-muted-foreground">{role}</p>
            </div>
          </div>
          <div className="h-px bg-border/60 my-6" />
          <div className="space-y-2">
            {menuItems.slice(0, 1).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between p-2 hover:bg-accent/60 rounded-lg transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center">
                  {item.value && (
                    <span className="text-sm text-muted-foreground mr-2">{item.value}</span>
                  )}
                  {item.external && <MoveUpRight className="w-4 h-4" />}
                </div>
              </Link>
            ))}

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Settings</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-foreground/80">
                  <span>Email alerts</span>
                  <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                </div>
                <div className="flex items-center justify-between text-sm text-foreground/80">
                  <span>Push notifications</span>
                  <Switch checked={pushAlerts} onCheckedChange={setPushAlerts} />
                </div>
                <div className="flex items-center justify-between text-sm text-foreground/80">
                  <span>Weekly report</span>
                  <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
                </div>
                <div className="flex items-center justify-between text-sm text-foreground/80">
                  <span>Two-factor auth</span>
                  <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Currency</span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm text-foreground"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Language</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm text-foreground"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="text-xs text-muted-foreground">Timezone</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm text-foreground"
                >
                  <option value="GMT">GMT (UTC+0)</option>
                  <option value="CET">CET (UTC+1)</option>
                  <option value="EST">EST (UTC-5)</option>
                </select>
              </label>
            </div>

            {menuItems.slice(1).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between p-2 hover:bg-accent/60 rounded-lg transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center">
                  {item.value && (
                    <span className="text-sm text-muted-foreground mr-2">{item.value}</span>
                  )}
                  {item.external && <MoveUpRight className="w-4 h-4" />}
                </div>
              </Link>
            ))}

            <button
              type="button"
              className="w-full flex items-center justify-between p-2 hover:bg-accent/60 rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium text-foreground">Logout</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
