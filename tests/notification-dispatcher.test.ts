import { describe, expect, it } from "vitest"

import { dispatchAlertNotification, dispatchTaskNotification } from "@/lib/notification-dispatcher"
import type { AlertItem, NotificationPreferences, TaskItem } from "@/lib/notification-types"

const makeTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: "task-1",
  title: "Payer le loyer",
  dueDate: "2026-02-10",
  reminder: "24 heures avant",
  notes: "Virement depuis le compte conjoint",
  completed: false,
  createdAt: "2026-02-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
  ...overrides,
})

const makeAlert = (overrides: Partial<AlertItem> = {}): AlertItem => ({
  id: "alert-1",
  title: "Solde bas",
  metric: "Solde du compte",
  threshold: "< 500 $",
  cadence: "Quotidien",
  createdAt: "2026-02-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
  ...overrides,
})

const prefs = (overrides: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  email: true,
  push: true,
  ...overrides,
})

describe("dispatchTaskNotification", () => {
  it("construit le payload d'un rappel de tâche", () => {
    const payload = dispatchTaskNotification(makeTask(), prefs())
    expect(payload.id).toBe("task-1")
    expect(payload.title).toBe("Rappel: Payer le loyer")
    expect(payload.description).toBe("Virement depuis le compte conjoint")
    expect(payload.source).toBe("task")
    expect(payload.channels).toEqual({ email: true, push: true })
    expect(Number.isNaN(Date.parse(payload.triggeredAt))).toBe(false)
  })

  it("utilise une description générique quand la tâche n'a pas de notes", () => {
    const payload = dispatchTaskNotification(makeTask({ notes: "" }), prefs())
    expect(payload.description).toBe("Tâche planifiée")
  })

  it("retombe sur les préférences globales sans surcharge de la tâche", () => {
    const payload = dispatchTaskNotification(makeTask(), prefs({ email: true, push: false }))
    expect(payload.channels).toEqual({ email: true, push: false })
  })

  it("les canaux propres à la tâche priment sur les préférences globales", () => {
    const payload = dispatchTaskNotification(
      makeTask({ channelEmail: false, channelPush: true }),
      prefs({ email: true, push: false })
    )
    expect(payload.channels).toEqual({ email: false, push: true })
  })

  it("une surcharge partielle ne change que le canal nommé", () => {
    const payload = dispatchTaskNotification(
      makeTask({ channelPush: false }),
      prefs({ email: true, push: true })
    )
    expect(payload.channels).toEqual({ email: true, push: false })
  })
})

describe("dispatchAlertNotification", () => {
  it("construit le payload d'une alerte avec métrique et seuil", () => {
    const payload = dispatchAlertNotification(makeAlert(), prefs())
    expect(payload.id).toBe("alert-1")
    expect(payload.title).toBe("Alerte: Solde bas")
    expect(payload.description).toBe("Solde du compte · Seuil < 500 $")
    expect(payload.source).toBe("alert")
    expect(payload.channels).toEqual({ email: true, push: true })
    expect(Number.isNaN(Date.parse(payload.triggeredAt))).toBe(false)
  })

  it("les canaux propres à l'alerte priment sur les préférences globales", () => {
    const payload = dispatchAlertNotification(
      makeAlert({ channelEmail: true, channelPush: false }),
      prefs({ email: false, push: true })
    )
    expect(payload.channels).toEqual({ email: true, push: false })
  })

  it("retombe sur les préférences globales sans surcharge de l'alerte", () => {
    const payload = dispatchAlertNotification(makeAlert(), prefs({ email: false, push: false }))
    expect(payload.channels).toEqual({ email: false, push: false })
  })
})
