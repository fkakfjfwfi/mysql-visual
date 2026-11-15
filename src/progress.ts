import { useEffect, useState } from 'react'
import { lessons } from './lessons'

const KEY = 'qinghe-sql-v1'

type Progress = {
  lessonId: string
  drafts: Record<string, string>
  passed: Record<string, string[]>
}

function emptyProgress(): Progress {
  return { lessonId: lessons[0].id, drafts: {}, passed: {} }
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<Progress>
    return {
      lessonId: typeof parsed.lessonId === 'string' ? parsed.lessonId : lessons[0].id,
      drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
      passed: parsed.passed && typeof parsed.passed === 'object' ? parsed.passed : {},
    }
  } catch {
    return emptyProgress()
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(progress))
  }, [progress])

  const passedCount = (lessonId: string) => progress.passed[lessonId]?.length ?? 0

  return {
    progress,
    passedCount,
    isComplete: (lessonId: string) => passedCount(lessonId) >= 3,
    setLessonId: (lessonId: string) => setProgress((current) => ({ ...current, lessonId })),
    setDraft: (lessonId: string, sql: string) =>
      setProgress((current) => ({ ...current, drafts: { ...current.drafts, [lessonId]: sql } })),
    clearDraft: (lessonId: string) =>
      setProgress((current) => {
        const drafts = { ...current.drafts }
        delete drafts[lessonId]
        return { ...current, drafts }
      }),
    markPassed: (lessonId: string, challengeId: string) =>
      setProgress((current) => {
        const existing = current.passed[lessonId] ?? []
        if (existing.includes(challengeId)) return current
        return { ...current, passed: { ...current.passed, [lessonId]: [...existing, challengeId] } }
      }),
    reset: () => setProgress(emptyProgress()),
  }
}
