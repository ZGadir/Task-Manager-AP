import { Check, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Subtask } from './types'

interface Props {
  subtasks: Subtask[]
  onToggle: (id: number) => void
  isDarkMode: boolean
}

const isLocked = (subtask: Subtask, allSubtasks: Subtask[]): boolean => {
  if (!subtask.dependsOn || subtask.dependsOn.length === 0) return false
  return subtask.dependsOn.some(depIndex => {
    const dep = allSubtasks[depIndex]
    return dep && !dep.done
  })
}

export default function ExecutionPlan({ subtasks, onToggle, isDarkMode }: Props) {
  void isDarkMode
  const [poppingId, setPoppingId] = useState<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [subtasks])

  useEffect(() => {
    const firstIncomplete = subtasks.findIndex(s => !s.done)
    if (firstIncomplete === -1) return
    const nodeWidth = 140
    const targetScroll = Math.max(0, (firstIncomplete - 1) * nodeWidth)
    scrollRef.current?.scrollTo({ left: targetScroll, behavior: 'smooth' })
  }, [subtasks])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
  }

  const handleClick = (subtask: Subtask, locked: boolean) => {
    if (locked) return
    setPoppingId(subtask.id)
    setTimeout(() => setPoppingId(null), 400)
    onToggle(subtask.id)
  }

  if (subtasks.length === 0) {
    return (
      <div className="execution-empty">
        No subtasks yet. Go through questioning and planning to generate them.
      </div>
    )
  }

  return (
    <div className="execution-plan-visual">
      {canScrollLeft && (
        <button className="exec-scroll-btn exec-scroll-left" onClick={() => scroll('left')}>
          <ChevronLeft size={20} />
        </button>
      )}

      <div className="execution-nodes-scroll" ref={scrollRef}>
        <div className="execution-nodes">
          {subtasks.map((subtask, index) => {
            const locked = isLocked(subtask, subtasks)
            const done = subtask.done

            return (
              <div key={subtask.id} className="node-wrapper">
                <div
                  className={`node ${done ? 'node-done' : ''} ${locked ? 'node-locked' : ''}`}
                  onClick={() => handleClick(subtask, locked)}
                  title={locked ? 'Complete previous subtasks first' : subtask.title}
                >
                  <div
                    className={`node-circle ${done ? 'completed' : ''} ${locked ? 'locked' : ''} ${poppingId === subtask.id ? 'popping' : ''}`}
                  >
                    {done ? (
                      <Check size={14} strokeWidth={3} />
                    ) : locked ? (
                      <Lock size={12} />
                    ) : (
                      <span className="node-number">{index + 1}</span>
                    )}
                  </div>
                  <div className="node-label">
                    <span className="node-title">{subtask.title}</span>
                    <span className="node-points">+{subtask.points} pts</span>
                  </div>
                </div>

                {index < subtasks.length - 1 && (
                  <div className={`node-arrow ${subtask.done ? 'arrow-lit' : ''}`}>
                    <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                      <line x1="0" y1="8" x2="26" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M22 3L29 8L22 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {canScrollRight && (
        <button className="exec-scroll-btn exec-scroll-right" onClick={() => scroll('right')}>
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  )
}
