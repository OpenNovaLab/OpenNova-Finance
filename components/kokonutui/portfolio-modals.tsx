"use client"

import React, { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  parseCurrencyToCents,
  type AccountItem,
  type Transaction,
  type FinancialGoal,
  type StockAction,
} from "@/lib/portfolio-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

const centsToInputValue = (valueCents?: number, fractionDigits = 2): string => {
  if (typeof valueCents !== "number" || !Number.isFinite(valueCents)) {
    return ""
  }
  return (valueCents / 100).toFixed(fractionDigits)
}

const isoToDateInputValue = (valueIso?: string): string => {
  if (!valueIso) return ""
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

const isoToMonthInputValue = (valueIso?: string): string => {
  if (!valueIso) return ""
  const parsed = new Date(valueIso)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 7)
}

const dateInputToIso = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const monthInputToIso = (value: string): string => {
  const parsed = new Date(`${value}-01T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const todayDateInputValue = () => new Date().toISOString().slice(0, 10)
const nextMonthInputValue = () => new Date().toISOString().slice(0, 7)

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-md border-border/60 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 p-4 pr-10">
          <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <div className="p-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (account: Omit<AccountItem, "id">) => void
  onDelete?: () => void
  initialData?: AccountItem
}

export function AccountModal({ isOpen, onClose, onSave, onDelete, initialData }: AccountModalProps) {
  const [title, setTitle] = useState(initialData?.title || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [balance, setBalance] = useState(centsToInputValue(initialData?.balanceCents))
  const [type, setType] = useState<AccountItem["type"]>(initialData?.type || "checking")

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setDescription(initialData.description || "")
      setBalance(centsToInputValue(initialData.balanceCents))
      setType(initialData.type)
    } else {
      setTitle("")
      setDescription("")
      setBalance("")
      setType("checking")
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title,
      description,
      balanceCents: parseCurrencyToCents(balance),
      type,
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Account" : "Add Account"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Account Name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="Main Savings"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="Personal savings"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              disabled={type === "investment"}
              required
              className={cn(
                "w-full pl-7 pr-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                type === "investment" && "opacity-70 cursor-not-allowed bg-muted/20"
              )}
              placeholder="0.00"
            />
          </div>
          {type === "investment" && (
            <p className="text-xs text-muted-foreground mt-1">
              Calculé automatiquement à partir de vos positions boursières (Actions &amp; ETFs).
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Account Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountItem["type"])}
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
            <option value="debt">Debt / Credit</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {initialData ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (transaction: Omit<Transaction, "id">) => void
  onDelete?: () => void
  initialData?: Transaction
}

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: TransactionModalProps) {
  const [title, setTitle] = useState(initialData?.title || "")
  const [amount, setAmount] = useState(centsToInputValue(initialData?.amountCents))
  const [type, setType] = useState<Transaction["type"]>(initialData?.type || "outgoing")
  const [category, setCategory] = useState(initialData?.category || "shopping")
  const [status, setStatus] = useState<Transaction["status"]>(initialData?.status || "completed")

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setAmount(centsToInputValue(initialData.amountCents))
      setType(initialData.type)
      setCategory(initialData.category)
      setStatus(initialData.status)
    } else {
      setTitle("")
      setAmount("")
      setType("outgoing")
      setCategory("shopping")
      setStatus("completed")
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title,
      amountCents: parseCurrencyToCents(amount),
      type,
      category,
      timestampIso: initialData?.timestampIso || new Date().toISOString(),
      status,
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Transaction" : "Add Transaction"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="Grocery shopping"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Transaction["type"])}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="incoming">Income</option>
              <option value="outgoing">Expense</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="shopping">Shopping</option>
              <option value="investment">Investment</option>
              <option value="income">Income</option>
              <option value="utilities">Utilities</option>
              <option value="debt">Debt Payment</option>
              <option value="food">Food & Dining</option>
              <option value="transport">Transport</option>
              <option value="entertainment">Entertainment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Transaction["status"])}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {initialData ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface StockActionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (action: Omit<StockAction, "id">) => void
  onDelete?: () => void
  initialData?: StockAction
}

export function StockActionModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: StockActionModalProps) {
  const [symbol, setSymbol] = useState(initialData?.symbol || "")
  const [action, setAction] = useState<StockAction["action"]>(initialData?.action || "buy")
  const [shares, setShares] = useState(initialData?.shares.toString() || "1")
  const [price, setPrice] = useState(centsToInputValue(initialData?.priceCents))
  const [tradeDate, setTradeDate] = useState(
    initialData ? isoToDateInputValue(initialData.tradeDateIso) : todayDateInputValue()
  )
  const [status, setStatus] = useState<StockAction["status"]>(initialData?.status || "executed")

  useEffect(() => {
    if (initialData) {
      setSymbol(initialData.symbol)
      setAction(initialData.action)
      setShares(initialData.shares.toString())
      setPrice(centsToInputValue(initialData.priceCents))
      setTradeDate(isoToDateInputValue(initialData.tradeDateIso))
      setStatus(initialData.status)
    } else {
      setSymbol("")
      setAction("buy")
      setShares("1")
      setPrice("")
      setTradeDate(todayDateInputValue())
      setStatus("executed")
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      symbol: symbol.toUpperCase(),
      action,
      shares: Number.parseFloat(shares) || 0,
      priceCents: parseCurrencyToCents(price),
      tradeDateIso: dateInputToIso(tradeDate || todayDateInputValue()),
      status,
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Trade" : "Add Trade"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Ticker Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="AAPL"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as StockAction["action"])}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Shares</label>
            <input
              type="number"
              step="0.01"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              placeholder="10"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Price per Share</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Trade Date</label>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StockAction["status"])}
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <option value="executed">Executed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {initialData ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface GoalModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Omit<FinancialGoal, "id">) => void
  onDelete?: () => void
  initialData?: FinancialGoal
}

export function GoalModal({ isOpen, onClose, onSave, onDelete, initialData }: GoalModalProps) {
  const [title, setTitle] = useState(initialData?.title || "")
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || "")
  const [amount, setAmount] = useState(centsToInputValue(initialData?.targetAmountCents, 0))
  const [iconStyle, setIconStyle] = useState(initialData?.iconStyle || "savings")
  const [status, setStatus] = useState<FinancialGoal["status"]>(initialData?.status || "pending")
  const [progress, setProgress] = useState(initialData?.progress?.toString() || "0")
  const [targetDate, setTargetDate] = useState(
    initialData ? isoToMonthInputValue(initialData.targetDateIso) : nextMonthInputValue()
  )

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setSubtitle(initialData.subtitle)
      setAmount(centsToInputValue(initialData.targetAmountCents, 0))
      setIconStyle(initialData.iconStyle)
      setStatus(initialData.status)
      setProgress(initialData.progress?.toString() || "0")
      setTargetDate(isoToMonthInputValue(initialData.targetDateIso))
    } else {
      setTitle("")
      setSubtitle("")
      setAmount("")
      setIconStyle("savings")
      setStatus("pending")
      setProgress("0")
      setTargetDate(nextMonthInputValue())
    }
  }, [initialData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title,
      subtitle,
      targetAmountCents: amount ? parseCurrencyToCents(amount) : undefined,
      iconStyle,
      status,
      progress: Number.parseInt(progress, 10) || 0,
      targetDateIso: monthInputToIso(targetDate || nextMonthInputValue()),
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Goal" : "Add Goal"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Goal Name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="Emergency Fund"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            placeholder="Save 3 months of expenses"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Target Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                placeholder="10000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Target Date</label>
            <input
              type="month"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={iconStyle}
              onChange={(e) => setIconStyle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="savings">Savings</option>
              <option value="investment">Investment</option>
              <option value="debt">Debt Payoff</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FinancialGoal["status"])}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background/40 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Progress: {progress}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            className="w-full h-2 bg-accent/60 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg border border-border/60 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {initialData ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
