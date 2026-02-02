import { useState, useEffect } from 'react'
import type { TimerPhase } from '../types'

const WORK_SECONDS = 25 * 60
const BREAK_SECONDS = 5 * 60

interface GrindingTimerProps {
  phase: TimerPhase
  seconds: number
  onPhaseChange: (p: TimerPhase) => void
  onSecondsChange: (s: number) => void
  onClose: () => void
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function GrindingTimer({
  phase,
  seconds,
  onPhaseChange,
  onSecondsChange,
  onClose,
}: GrindingTimerProps) {
  const [displaySeconds, setDisplaySeconds] = useState(seconds)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || phase === 'idle') return
    const id = setInterval(() => {
      setDisplaySeconds(prev => {
        if (prev <= 1) {
          setRunning(false)
          if (phase === 'work') {
            onPhaseChange('break')
            setDisplaySeconds(BREAK_SECONDS)
            onSecondsChange(BREAK_SECONDS)
          } else {
            onPhaseChange('idle')
            setDisplaySeconds(WORK_SECONDS)
            onSecondsChange(WORK_SECONDS)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, phase, onPhaseChange, onSecondsChange])

  const startWork = () => {
    onPhaseChange('work')
    setDisplaySeconds(WORK_SECONDS)
    onSecondsChange(WORK_SECONDS)
    setRunning(true)
  }
  const startBreak = () => {
    onPhaseChange('break')
    setDisplaySeconds(BREAK_SECONDS)
    onSecondsChange(BREAK_SECONDS)
    setRunning(true)
  }

  return (
    <div className="ide-timer-modal">
      <div className={`ide-timer-display ${phase === 'break' ? 'break' : 'work'}`}>
        {formatTime(displaySeconds)}
      </div>
      <div className="ide-timer-actions">
        {phase === 'idle' && (
          <>
            <button type="button" className="primary" onClick={startWork}>
              ⏱️ 25min 專注
            </button>
            <button type="button" onClick={startBreak}>
              5min 休息
            </button>
          </>
        )}
        {(phase === 'work' || phase === 'break') && (
          <>
            <button type="button" onClick={() => setRunning(!running)}>
              {running ? '暫停' : '繼續'}
            </button>
            <button type="button" onClick={() => { setRunning(false); onPhaseChange('idle'); setDisplaySeconds(WORK_SECONDS); onSecondsChange(WORK_SECONDS); }}>
              重置
            </button>
          </>
        )}
        <button type="button" onClick={onClose}>關閉</button>
      </div>
    </div>
  )
}
