// src/App.tsx
// ===============================
// MAIN APP FILE (3-column layout)
// Left  = Workspaces (Tasks/Projects list)
// Middle= Selected workspace details
// Right = Assistant panel (UI only for now)
// ===============================

import { useState, useEffect, useRef, type MouseEvent, type RefObject } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactMarkdown from 'react-markdown'
import './App.css'
import { Plus, Moon, Sun, MoreHorizontal, Archive, Trash2, ArrowUp, Sparkles, Lock, ChevronRight, Settings } from 'lucide-react'
import ExecutionPlan from './ExecutionPlan'
import { Workspace, Subtask, AssistantMessage } from './types'
import {
  checkOllamaRunning,
  generateSubtasks,
  improveTaskDescription,
  sendGreeting,
  sendQuestioningMessage,
  sendPlanningMessage,
  sendExecutionMessage,
  sendReviewMessage,
  generateBonusChallenges
} from './aiService'
import { extractDocumentText, truncateDocument } from './documentParser'

function useCountUp(target: number, duration: number = 600) {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)

  useEffect(() => {
    if (prev.current === target) return
    const start = prev.current
    const diff = target - start
    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prev.current = target
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return display
}

function SortableWorkspaceItem({
  workspace,
  isSelected,
  openMenuId,
  workspaceMenuRef,
  onSelect,
  onMenuToggle,
  onArchive,
  onDelete,
  isDarkMode
}: {
  workspace: Workspace
  isSelected: boolean
  openMenuId: number | null
  workspaceMenuRef?: RefObject<HTMLDivElement>
  onSelect: (id: number) => void
  onMenuToggle: (e: React.MouseEvent, id: number) => void
  onArchive: (id: number) => void
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, id: number) => void
  isDarkMode: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: workspace.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`workspace-item ${workspace.type} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(workspace.id)}
    >
      <div className="workspace-header" ref={openMenuId === workspace.id ? workspaceMenuRef : undefined}>
        <span className="workspace-type">{workspace.type.toUpperCase()}</span>
        <button
          className="workspace-menu-btn"
          onClick={(e) => onMenuToggle(e, workspace.id)}
          title="Workspace actions"
        >
          <MoreHorizontal size={15} />
        </button>

        {openMenuId === workspace.id && (
          <div className="workspace-dropdown">
            <button
              className="workspace-dropdown-item"
              onClick={(e) => {
                e.stopPropagation()
                onArchive(workspace.id)
              }}
            >
              <Archive size={14} /> Archive
            </button>
            <button
              className="workspace-dropdown-item delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(e, workspace.id)
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
      <span className="workspace-title">{workspace.title}</span>
      <div className="workspace-stats">
        <span className="workspace-points">
          <DiamondIcon size={11} color={isDarkMode ? '#a855f7' : '#f97316'} /> {workspace.points} pts
        </span>
        <span className="workspace-progress-text">{workspace.progress}%</span>
      </div>
      <div className="workspace-progress-bar">
        <div
          className="workspace-progress-fill"
          style={{ width: `${workspace.progress}%` }}
        />
      </div>
    </div>
  )
}

function DiamondIcon({ size = 16, color = 'currentColor' }: { size?: number, color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Main body */}
      <polygon
        points="12,2 22,9 12,22 2,9"
        fill={color}
      />
      {/* Top right face — lighter */}
      <polygon
        points="12,2 22,9 12,9"
        fill="white"
        opacity="0.35"
      />
      {/* Bottom left face — darker */}
      <polygon
        points="2,9 12,9 12,22"
        fill="black"
        opacity="0.2"
      />
      {/* Inner shine — small highlight top */}
      <polygon
        points="12,4 18,9 12,9"
        fill="white"
        opacity="0.25"
      />
    </svg>
  )
}



export default function App() {
  // ===============================
  // STATE: Workspaces + Selection
  // ===============================
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const DATA_VERSION = '2'
    if (localStorage.getItem('dataVersion') !== DATA_VERSION) {
      localStorage.removeItem('workspaces')
      localStorage.removeItem('archivedWorkspaces')
      localStorage.removeItem('chatHistories')
      localStorage.setItem('dataVersion', DATA_VERSION)
      return []
    }
    const saved = localStorage.getItem('workspaces')
    if (saved) return JSON.parse(saved)
    return []
  })
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(0)
  // ===============================
  // STATE: Create Task/Project Modal
  // ===============================
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImprovingAI, setIsImprovingAI] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalDescription, setModalDescription] = useState('')

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [chatHistories, setChatHistories] = useState<Record<number, AssistantMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('chatHistories')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [assistantInput, setAssistantInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '')
  const [apiProvider, setApiProvider] = useState(() => localStorage.getItem('apiProvider') || 'ollama')
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('selectedModel') || 'qwen2.5:7b')
  const [workspaceModes, setWorkspaceModes] = useState<Record<number, 'questioning' | 'planning' | 'execution' | 'review'>>({})
  const [planningStage, setPlanningStage] = useState<Record<number, 'summary' | 'generate'>>({})

  const assistantMode = selectedWorkspaceId
    ? (workspaceModes[selectedWorkspaceId] || 'questioning')
    : 'questioning'

  const setAssistantMode = (mode: 'questioning' | 'planning' | 'execution' | 'review') => {
    if (!selectedWorkspaceId) return
    setWorkspaceModes(prev => ({ ...prev, [selectedWorkspaceId]: mode }))
  }
  const assistantMessages = chatHistories[selectedWorkspaceId] || []

  const setAssistantMessages = (updater: AssistantMessage[] | ((prev: AssistantMessage[]) => AssistantMessage[])) => {
    setChatHistories(prev => {
      const current = prev[selectedWorkspaceId] || []
      const next = typeof updater === 'function' ? updater(current) : updater
      return { ...prev, [selectedWorkspaceId]: next }
    })
  }
  const [isAILoading, setIsAILoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    if (!showSplash) return
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [showSplash])
  const [bonusChallenges, setBonusChallenges] = useState<Record<number, { title: string; reason: string; subtaskTitle: string }[]>>({})
  const [loadingBonuses, setLoadingBonuses] = useState(false)
  const [planningTabPulse, setPlanningTabPulse] = useState(false)
  const [reviewTabPulse, setReviewTabPulse] = useState(false)
  const completionMessageSent = useRef<Record<number, boolean>>({})
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null)
  const [uploadedDocument, setUploadedDocument] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [archivedWorkspaces, setArchivedWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('archivedWorkspaces')
    if (saved) return JSON.parse(saved)
    return []
  })
  const [showArchived, setShowArchived] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [recentlyDeleted, setRecentlyDeleted] = useState<{
    subtask: Subtask
    workspaceId: number
    timestamp: number
  }[]>([])
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true'
  })
  const [centerFading, setCenterFading] = useState(false)
  const [centerLoading, setCenterLoading] = useState(false)
  const [assistantWidth, setAssistantWidth] = useState(380)
  const isResizing = useRef(false)

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startWidth = assistantWidth

    const onMouseMove = (ev: globalThis.MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX - ev.clientX
      const newWidth = Math.min(600, Math.max(280, startWidth + delta))
      setAssistantWidth(newWidth)
    }

    const onMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  const [completingId, setCompletingId] = useState<number | null>(null)
  const [visualMode, setVisualMode] = useState(true)
  const [assistantCollapsed, setAssistantCollapsed] = useState(false)
  const assistantBodyRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      localStorage.setItem('darkMode', String(!prev))
      return !prev
    })
  }

  const [notification, setNotification] = useState<{message: string; show: boolean}>({message: '', show: false})  // eslint-disable-next-line @typescript-eslint/no-unused-vars  const [completedTasksStreak, setCompletedTasksStreak] = useState(0)

  useEffect(() => {
    localStorage.setItem('workspaces', JSON.stringify(workspaces))
  }, [workspaces])

  useEffect(() => {
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories))
  }, [chatHistories])

  useEffect(() => {
    localStorage.setItem('archivedWorkspaces', JSON.stringify(archivedWorkspaces))
  }, [archivedWorkspaces])

  useEffect(() => {
    checkOllamaRunning().then(running => {
      setOllamaRunning(running)
    })
  }, [])

  useEffect(() => {
    const handleClickOutsideMenu = (event: globalThis.MouseEvent) => {
      if (!workspaceMenuRef.current) return
      if (!workspaceMenuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutsideMenu)
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu)
    }
  }, [])

  // When selectedWorkspaceId changes and chat is empty, generate greeting
  useEffect(() => {
    if (!selectedWorkspaceId || !ollamaRunning) return
    const currentMessages = chatHistories[selectedWorkspaceId]
    if (currentMessages && currentMessages.length > 0) return // already has chat

    const workspace = workspaces.find(w => w.id === selectedWorkspaceId)
    if (!workspace) return

    const generateGreeting = async () => {
      try {
        const greeting = await sendGreeting(workspace.title, workspace.description)
        setChatHistories(prev => ({
          ...prev,
          [selectedWorkspaceId]: [{ role: 'assistant', content: greeting }]
        }))
      } catch {
        setChatHistories(prev => ({
          ...prev,
          [selectedWorkspaceId]: [{
            role: 'assistant',
            content: `Hi! I see you're working on "${workspace.title}". What would you like to clarify before we plan this out?`
          }]
        }))
      }
    }

    generateGreeting()
  }, [selectedWorkspaceId])

  useEffect(() => {
    if (assistantBodyRef.current) {
      assistantBodyRef.current.scrollTop = assistantBodyRef.current.scrollHeight
    }
  }, [assistantMessages, isAILoading])

  // Get current workspace
  const currentWorkspace =
    workspaces.find(w => w.id === selectedWorkspaceId) ||
    archivedWorkspaces.find(w => w.id === selectedWorkspaceId);
  const isArchived = archivedWorkspaces.some(w => w.id === selectedWorkspaceId);

  // Calculate total points across all workspaces
  const totalOverallPoints = workspaces.reduce((sum, w) => sum + w.points, 0);
  const displayPoints = useCountUp(totalOverallPoints)

  // Calculate progress for a workspace
  const calculateProgress = (workspace: Workspace) => {
    if (!workspace || workspace.subtasks.length === 0) return 0;
    const completedCount = workspace.subtasks.filter(s => s.done).length;
    return Math.round((completedCount / workspace.subtasks.length) * 100);
  };



  // Show notification
  const showNotification = (message: string) => {
    setNotification({ message, show: true });
    setTimeout(() => {
      setNotification({ message: '', show: false });
    }, 3000);
  };

  // Update workspace
  const updateWorkspace = (workspaceId: number, updates: Partial<Workspace>) => {
    setWorkspaces(workspaces.map(w => 
      w.id === workspaceId ? { ...w, ...updates } : w
    ));
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim() || !currentWorkspace) return;
    
    const newSubtask: Subtask = {
      id: Date.now(),
      title: newSubtaskTitle,
      done: false,
      points: 5
    };
    
    const updatedSubtasks = [...(currentWorkspace.subtasks || []), newSubtask];
    updateWorkspace(selectedWorkspaceId, { subtasks: updatedSubtasks });
    setNewSubtaskTitle("");
  };

  const handleToggleSubtask = (workspaceId: number, subtaskId: number) => {
    setCompletingId(subtaskId)
    setTimeout(() => setCompletingId(null), 500)
    if (!currentWorkspace) return;

    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(workspace => {
        if (workspace.id !== workspaceId) return workspace;

        // Find the subtask
        const subtask = workspace.subtasks.find(s => s.id === subtaskId);
        if (!subtask) return workspace;

        // Toggle the subtask
        const updatedSubtasks = workspace.subtasks.map(s => 
          s.id === subtaskId ? { ...s, done: !s.done } : s
        );

        // Calculate new progress and points
        const completedCount = updatedSubtasks.filter(s => s.done).length;
        const newProgress = updatedSubtasks.length === 0 
          ? 0 
          : Math.round((completedCount / updatedSubtasks.length) * 100);
        const newPoints = updatedSubtasks
          .filter(s => s.done)
          .reduce((sum, s) => sum + s.points, 0);

        // Show notification only when checking (not unchecking)
        if (!subtask.done) {
          showNotification(`Nice job! +${subtask.points} points`);

          // Check for streak
          if (completedCount > 0 && completedCount % 3 === 0) {
            setTimeout(() => {
              showNotification(` You're on a streak! +100 bonus points`);
              setWorkspaces(prev => prev.map(w =>
                w.id === workspaceId
                  ? { ...w, points: w.points + 100 }
                  : w
              ));
            }, 1500);
          }

          // Check if all subtasks are now done
          const allDone = updatedSubtasks.every(s => s.done)
          if (allDone && updatedSubtasks.length > 0 && !completionMessageSent.current[workspace.id]) {
            completionMessageSent.current[workspace.id] = true
            setTimeout(() => setShowArchiveModal(true), 600)
            setReviewTabPulse(true)
            setChatHistories(prev => {
              const current = prev[workspace.id] || []
              return {
                ...prev,
                [workspace.id]: [...current, {
                  role: 'assistant',
                  content: `You've completed all subtasks for "${workspace.title}" — great work! Switch to the REVIEW tab whenever you're ready to reflect on what you built.`
                }]
              }
            })
          }

          if (!allDone) {
            completionMessageSent.current[workspace.id] = false
          }
        }

        return {
          ...workspace,
          subtasks: updatedSubtasks,
          progress: newProgress,
          points: newPoints
        };
      });
    });
  };

  const handleFinishTask = () => {
    if (!currentWorkspace) return;
    
    const updatedSubtasks = currentWorkspace.subtasks.map(s => ({ ...s, done: true }));
    const totalSubtaskPoints = currentWorkspace.subtasks.reduce((sum, s) => sum + s.points, 0);
    
    updateWorkspace(selectedWorkspaceId, {
      subtasks: updatedSubtasks,
      progress: 100,
      points: totalSubtaskPoints
    });
    
    showNotification(`🎉 Task completed! You earned ${totalSubtaskPoints} points!`);
    setShowArchiveModal(true);
  };

  const isSubtaskLocked = (subtask: Subtask, allSubtasks: Subtask[]): boolean => {
    if (!subtask.dependsOn || subtask.dependsOn.length === 0) return false
    return subtask.dependsOn.some(depIndex => {
      const depSubtask = allSubtasks[depIndex]
      if (!depSubtask) return false
      return !depSubtask.done
    })
  }

  const handleArchiveWorkspace = (workspaceId: number) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (!workspace) return

    setArchivedWorkspaces(prev => [workspace, ...prev])
    const remaining = workspaces.filter(w => w.id !== workspaceId)
    setWorkspaces(remaining)

    if (remaining.length > 0) {
      setSelectedWorkspaceId(remaining[0].id)
    }

    setShowArchiveModal(false)
    setOpenMenuId(null)
  }

  const handleUnarchiveWorkspace = (workspaceId: number) => {
    const workspace = archivedWorkspaces.find(w => w.id === workspaceId)
    if (!workspace) return

    setWorkspaces(prev => [workspace, ...prev])
    setArchivedWorkspaces(prev => prev.filter(w => w.id !== workspaceId))
    setSelectedWorkspaceId(workspaceId)
  }

  const handleDeleteWorkspace = (e: MouseEvent<HTMLButtonElement>, workspaceId: number) => {
    e.stopPropagation();
    if (workspaces.length === 1) return;
    const remaining = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(remaining);
    setChatHistories(prev => {
      const updated = { ...prev }
      delete updated[workspaceId]
      return updated
    })
    setPlanningStage(prev => {
      const updated = { ...prev }
      delete updated[workspaceId]
      return updated
    })
    completionMessageSent.current[workspaceId] = false
    if (selectedWorkspaceId === workspaceId) {
      setSelectedWorkspaceId(remaining[0].id);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsAILoading(true)
      const text = await extractDocumentText(file)
      const truncated = truncateDocument(text)
      setUploadedDocument(truncated)
      setUploadedFileName(file.name)
      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        content: `📄 I've read "${file.name}" successfully!\n\nI'll use this document to generate relevant subtasks for your task. Just tell me which task you want to work on or describe what you need to do.`
      }])
    } catch (error) {
      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Sorry, I couldn't read that file. Please make sure it's a PDF or Word document.`
      }])
    } finally {
      setIsAILoading(false)
    }
  }

  const handleAssistantSend = async () => {
    if (!assistantInput.trim() || isAILoading) return

    const userMessage = assistantInput.trim()
    setAssistantInput('')
    setAssistantMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsAILoading(true)

    try {
      const conversationHistory = assistantMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }))

      if (assistantMode === 'questioning') {
        if (!currentWorkspace) {
          setAssistantMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Please select or create a task first so I can help you plan it.'
          }])
          setIsAILoading(false)
          return
        }

        const response = await sendQuestioningMessage(
          currentWorkspace.title,
          currentWorkspace.description,
          [...conversationHistory, { role: 'user' as const, content: userMessage }]
        )

        setAssistantMessages(prev => [...prev, {
          role: 'assistant',
          content: response
        }])

        if (response.toLowerCase().includes('planning tab')) {
          setTimeout(() => {
            setAssistantMode('planning')
            setPlanningTabPulse(false)
          }, 1000)
        }

      } else if (assistantMode === 'planning') {
        if (!currentWorkspace) return

        const conversationSummary = chatHistories[currentWorkspace.id]
          ?.filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' ')
          .slice(0, 400) || ''

        const currentPlanningStage = planningStage[currentWorkspace.id] || 'summary'

        if (currentPlanningStage === 'summary') {
          // Stage 1 — show vision summary
          const summary = await sendPlanningMessage(
            currentWorkspace.title,
            currentWorkspace.description,
            conversationSummary,
            [...conversationHistory, { role: 'user' as const, content: userMessage }]
          )
          const cleanSummary = summary.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/g, '').trim()
          setAssistantMessages(prev => [...prev, { role: 'assistant', content: cleanSummary }])
          setPlanningStage(prev => ({ ...prev, [currentWorkspace.id]: 'generate' }))

        } else {
          // Stage 2 — generate subtasks
          setAssistantMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Generating your subtasks...'
          }])

          let result = await generateSubtasks(
            currentWorkspace.title,
            currentWorkspace.description,
            conversationSummary,
            undefined,
            uploadedDocument || undefined
          )

          if (result.subtasks.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const retry = await generateSubtasks(
              currentWorkspace.title,
              currentWorkspace.description,
              conversationSummary,
              undefined,
              uploadedDocument || undefined
            )
            if (retry.subtasks.length > 0) {
              result = retry
            }
          }

          if (result.subtasks.length > 0) {
            const newSubtasks: Subtask[] = result.subtasks.map((s, index) => ({
              id: Date.now() + index,
              title: s.title,
              done: false,
              points: s.points,
              dependsOn: s.dependsOn || []
            }))

            updateWorkspace(currentWorkspace.id, {
              subtasks: [...currentWorkspace.subtasks, ...newSubtasks]
            })

            setAssistantMessages(prev => [
              ...prev.slice(0, -1),
              {
                role: 'assistant',
                content: `I've created ${result.subtasks.length} subtasks for you (${result.totalPoints} pts total).\n\n${result.reasoning}\n\nYou can see them in the Execution Plan. Ask me anything as you work through them.`
              }
            ])

            setAssistantMode('execution')
          } else {
            setAssistantMessages(prev => [
              ...prev.slice(0, -1),
              {
                role: 'assistant',
                content: 'I had trouble generating subtasks. Could you give me a bit more detail?'
              }
            ])
          }
        }

      } else if (assistantMode === 'execution') {
        if (!currentWorkspace) return

        const completedSubtasks = currentWorkspace.subtasks
          .filter(s => s.done)
          .map(s => s.title)

        const pendingSubtasks = currentWorkspace.subtasks
          .filter(s => !s.done)
          .map(s => s.title)

        const response = await sendExecutionMessage(
          currentWorkspace.title,
          completedSubtasks,
          pendingSubtasks,
          [...conversationHistory, { role: 'user' as const, content: userMessage }]
        )

        setAssistantMessages(prev => [...prev, {
          role: 'assistant',
          content: response
        }])

      } else if (assistantMode === 'review') {
        if (!currentWorkspace) return

        const completedSubtasks = currentWorkspace.subtasks
          .filter(s => s.done)
          .map(s => s.title)

        const response = await sendReviewMessage(
          currentWorkspace.title,
          completedSubtasks,
          [...conversationHistory, { role: 'user' as const, content: userMessage }]
        )

        setAssistantMessages(prev => [...prev, {
          role: 'assistant',
          content: response
        }])
      }

    } catch (error) {
      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Make sure Ollama is running and try again.'
      }])
    } finally {
      setIsAILoading(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setWorkspaces(items => {
      const oldIndex = items.findIndex(w => w.id === active.id)
      const newIndex = items.findIndex(w => w.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleDeleteSubtask = (subtaskId: number) => {
    if (!currentWorkspace) return
    const subtask = currentWorkspace.subtasks.find(s => s.id === subtaskId)
    if (!subtask) return

    setRecentlyDeleted(prev => {
      const updated = [
        { subtask, workspaceId: selectedWorkspaceId, timestamp: Date.now() },
        ...prev
      ]
      return updated.slice(0, 10)
    })

    const updatedSubtasks = currentWorkspace.subtasks.filter(s => s.id !== subtaskId)
    updateWorkspace(selectedWorkspaceId, { subtasks: updatedSubtasks })
  }

  const handleRestoreSubtask = (index: number) => {
    const item = recentlyDeleted[index]
    if (!item) return
    const workspace = workspaces.find(w => w.id === item.workspaceId)
    if (!workspace) return
    const updatedSubtasks = [...workspace.subtasks, item.subtask]
    updateWorkspace(item.workspaceId, { subtasks: updatedSubtasks })
    setRecentlyDeleted(prev => prev.filter((_, i) => i !== index))
  }

  const handleImproveWithAI = async () => {
    if (!modalDescription.trim()) return
    if (!ollamaRunning) return

    setIsImprovingAI(true)
    try {
      const result = await improveTaskDescription(modalDescription)
      if (result.title) setModalTitle(result.title)
      if (result.description) setModalDescription(result.description)
    } catch {
      showNotification('Could not connect to Ollama')
    } finally {
      setIsImprovingAI(false)
    }
  }

  const handleSelectWorkspace = (workspaceId: number) => {
    if (workspaceId === selectedWorkspaceId) return
    setCenterFading(true)
    setCenterLoading(true)
    setTimeout(() => {
      setSelectedWorkspaceId(workspaceId)
      setNewSubtaskTitle("")
      setCenterFading(false)
      setTimeout(() => setCenterLoading(false), 800)
    }, 200)
  };

  // ===============================
  // ACTION: Create a workspace (Task or Project)
  // ===============================
  function createWorkspace(data: { title: string; description: string; type: 'task' | 'project' }) {
    const id = Math.max(...workspaces.map(w => typeof w.id === 'number' ? w.id : 0), 0) + 1
    const newWs: Workspace = {
      id,
      title: data.title.trim() || (data.type === 'task' ? 'New Task' : 'New Project'),
      description: data.description.trim(),
      type: data.type,
      progress: 0,
      points: 0,
      subtasks: []
    }

    setWorkspaces((prev) => [newWs, ...prev])
    setSelectedWorkspaceId(id)
    setIsCreateOpen(false)
    setModalTitle('')
    setModalDescription('')
  }

  // ===============================
  // - Add subtasks + points system
  // - Save/load from disk (Electron FS)
  // ===============================

  const handleModeSwitch = (mode: 'questioning' | 'planning' | 'execution' | 'review') => {
    if (!currentWorkspace || mode === assistantMode) return
    setAssistantMode(mode)

    const phaseMessages: Record<string, string> = {
      planning: `Ready to plan! Based on our conversation I have everything I need. Type anything to generate your subtasks for "${currentWorkspace.title}".`,
      execution: `Let's get to work! Your execution plan is ready. Start with the first subtask and ask me if you need any guidance.`,
      questioning: `Back to questioning mode. What would you like to clarify about "${currentWorkspace.title}"?`
    }

    const message = phaseMessages[mode]
    if (message) {
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: message }])
    }
  }

  return (
    <div className={`app app-layout ${isDarkMode ? 'dark' : ''} ${assistantCollapsed ? 'assistant-collapsed' : ''}`}>
      {showSplash && (
        <div className="splash-screen">
          <div className="splash-content">
            <img src="/logo-orange.svg" alt="TaskQuest" className="splash-logo" />
            <h1 className="splash-title">TaskQuest</h1>
            <p className="splash-subtitle">Plan smarter. Learn deeper. Achieve more.</p>
          </div>
        </div>
      )}

      {/* =======================================================
          LEFT PANEL (SIDEBAR): Workspaces list + Add button
          ======================================================= */}

          
      <aside className="sidebar">
        <div className="sidebar-header">
          <img
            src={isDarkMode ? '/logo-orange.svg' : '/logo-dark.svg'}
            alt="TaskQuest"
            className="logo-img"
          />
          <div className="title">TaskQuest</div>
          <button
            className="icon-btn"
            title="New Task / Project"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Overall points display */}
        <div className="overall-points">
          <DiamondIcon size={28} color={isDarkMode ? '#a855f7' : '#f97316'} />
          <span className="points-value">{displayPoints}</span>
          <span className="points-label">Total Points</span>
        </div>

        <div className="workspace-list">
          {workspaces.length === 0 && (
            <div className="empty-left">
              <p>No tasks yet.</p>
              <p>Press <strong>+</strong> to get started.</p>
              <div className="ghost-workspace-list">
                {/* Ghost card 1 — TASK */}
                <div className="workspace-item task ghost-workspace-card" style={{opacity: 0.6, animationDelay: '0s', cursor:'default'}}>
                  <div className="workspace-header">
                    <span className="workspace-type">TASK</span>
                  </div>
                  <div className="ghost-ws-title" style={{width:'78%'}} />
                  <div className="workspace-stats" style={{marginTop:8}}>
                    <div className="ghost-ws-title" style={{width:48, height:10, marginBottom:0}} />
                    <div className="ghost-ws-title" style={{width:24, height:10, marginBottom:0}} />
                  </div>
                  <div className="workspace-progress-bar"><div className="workspace-progress-fill" style={{width:'0%'}} /></div>
                </div>

                {/* Ghost card 2 — PROJECT */}
                <div className="workspace-item project ghost-workspace-card" style={{opacity: 0.35, animationDelay: '0.2s', cursor:'default'}}>
                  <div className="workspace-header">
                    <span className="workspace-type">PROJECT</span>
                  </div>
                  <div className="ghost-ws-title" style={{width:'62%'}} />
                  <div className="workspace-stats" style={{marginTop:8}}>
                    <div className="ghost-ws-title" style={{width:48, height:10, marginBottom:0}} />
                    <div className="ghost-ws-title" style={{width:24, height:10, marginBottom:0}} />
                  </div>
                  <div className="workspace-progress-bar"><div className="workspace-progress-fill" style={{width:'0%'}} /></div>
                </div>

                {/* Ghost card 3 — TASK */}
                <div className="workspace-item task ghost-workspace-card" style={{opacity: 0.15, animationDelay: '0.4s', cursor:'default'}}>
                  <div className="workspace-header">
                    <span className="workspace-type">TASK</span>
                  </div>
                  <div className="ghost-ws-title" style={{width:'85%'}} />
                  <div className="workspace-stats" style={{marginTop:8}}>
                    <div className="ghost-ws-title" style={{width:48, height:10, marginBottom:0}} />
                    <div className="ghost-ws-title" style={{width:24, height:10, marginBottom:0}} />
                  </div>
                  <div className="workspace-progress-bar"><div className="workspace-progress-fill" style={{width:'0%'}} /></div>
                </div>
              </div>
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={workspaces.map(w => w.id)}
              strategy={verticalListSortingStrategy}
            >
              {workspaces.map(workspace => (
                <SortableWorkspaceItem
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={selectedWorkspaceId === workspace.id}
                  openMenuId={openMenuId}
                  workspaceMenuRef={workspaceMenuRef}
                  onSelect={handleSelectWorkspace}
                  onMenuToggle={(e, id) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === id ? null : id)
                  }}
                  onArchive={handleArchiveWorkspace}
                  onDelete={handleDeleteWorkspace}
                  isDarkMode={isDarkMode}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* ARCHIVED SECTION */}
        <div className="archived-section">
          <button
            className="archived-toggle"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive size={14} />
            Archived ({archivedWorkspaces.length})
            <span className="archived-chevron">{showArchived ? '▲' : '▼'}</span>
          </button>

          {showArchived && (
            <div className="archived-list">
              {archivedWorkspaces.length === 0 && (
                <div className="empty-left">No archived tasks</div>
              )}
              {archivedWorkspaces.map(workspace => (
                <div
                  key={workspace.id}
                  className={`workspace-item archived ${selectedWorkspaceId === workspace.id ? 'selected' : ''}`}
                  onClick={() => handleSelectWorkspace(workspace.id)}
                >
                  <div className="workspace-header">
                    <span className="workspace-type">{workspace.type.toUpperCase()}</span>
                    <button
                      className="workspace-menu-btn"
                      style={{ opacity: 1 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnarchiveWorkspace(workspace.id)
                      }}
                      title="Unarchive"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                  <span className="workspace-title">{workspace.title}</span>
                  <div className="workspace-stats">
                    <span className="workspace-points">
                      <DiamondIcon size={11} color="#94a3b8" /> {workspace.points} pts
                    </span>
                    <span className="workspace-progress-text">100%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="muted">Local Only Mode</div>
          <div className="sidebar-footer-actions">
            <button
              className="icon-btn"
              title="Toggle Dark Mode"
              onClick={toggleDarkMode}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* =======================================================
          MIDDLE PANEL (CENTER): Selected workspace view
          ======================================================= */}

      <main className={`center center-panel ${centerFading ? 'fading' : ''}`} style={{ position: 'relative' }}>
        {centerLoading && (
          <div className="center-loading-overlay">
            <div className="center-loading-spinner">
              <img src={isDarkMode ? '/logo-orange.svg' : '/logo-dark.svg'} alt="" />
            </div>
          </div>
        )}
        {currentWorkspace ? (
          <>
            <div className="center-header">
              <div className="crumbs">
                {currentWorkspace.type === 'task' ? 'Daily Task' : 'Project'}{' '}
                <span>›</span> <span>Workspace</span>
                {isArchived && <span className="archived-badge">Archived</span>}
              </div>

              <h1>{currentWorkspace.title}</h1>
              <p>{currentWorkspace.description}</p>

              <div className="header-divider" />

              <div className="header-stats">
                <span className="pts-badge">
                  <DiamondIcon size={14} color={isDarkMode ? '#a855f7' : '#f97316'} /> {currentWorkspace.points} pts earned
                </span>
              </div>

              <div className="progress-row">
                <span className="progress-label">Progress</span>
                <span className="progress-percent">{calculateProgress(currentWorkspace)}%</span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${calculateProgress(currentWorkspace)}%` }}
                />
              </div>
            </div>

            <div className="execution-plan">
              <div className="execution-card">

                {/* Header */}
                <div className="execution-header">
                  <span className="execution-title">Execution Plan</span>
                  <button
                    className="view-toggle-btn"
                    onClick={() => setVisualMode(prev => !prev)}
                  >
                    {visualMode ? 'List View' : 'Visual View'}
                  </button>
                </div>

                <div className="execution-divider" />

                {/* Empty state */}
                {!visualMode && currentWorkspace.subtasks.length === 0 && (
                  <p className="execution-empty">No subtasks added yet — add one below.</p>
                )}

                {/* Subtasks list */}
                {visualMode ? (
                  <ExecutionPlan
                    subtasks={currentWorkspace.subtasks}
                    onToggle={(id) => handleToggleSubtask(currentWorkspace.id, id)}
                    isDarkMode={isDarkMode}
                  />
                ) : (
                  <div className="subtasks-list">
                  {currentWorkspace.subtasks.map((subtask) => {
                    const locked = isSubtaskLocked(subtask, currentWorkspace.subtasks)
                    return (
                      <div
                        key={subtask.id}
                        className={`subtask-item ${subtask.done ? 'completed' : ''} ${completingId === subtask.id ? 'completing' : ''} ${locked && !subtask.done ? 'locked' : ''}`}
                        onClick={() => {
                          if (subtask.done) {
                            handleToggleSubtask(currentWorkspace.id, subtask.id)
                          } else if (!locked) {
                            handleToggleSubtask(currentWorkspace.id, subtask.id)
                          }
                        }}
                        style={{ cursor: locked && !subtask.done ? 'not-allowed' : 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          disabled={locked && !subtask.done}
                          onChange={() => {
                            if (subtask.done || !locked) {
                              handleToggleSubtask(currentWorkspace.id, subtask.id)
                            }
                          }}
                          className="subtask-checkbox"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`subtask-title ${locked ? 'locked-title' : ''}`}>
                          {locked && <Lock size={12} className="lock-icon" />}
                          {subtask.title}
                        </span>
                        <span className="subtask-points">
                          <DiamondIcon size={11} color={isDarkMode ? '#a855f7' : '#f97316'} /> +{subtask.points} pts
                        </span>
                        <button
                          className="subtask-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSubtask(subtask.id)
                          }}
                          title="Delete subtask"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                  </div>
                )}

                {/* Input row */}
                <div className="execution-input-row">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className="execution-input"
                  />
                  <button onClick={handleAddSubtask} className="execution-add-btn">
                    + Add
                  </button>
                </div>

                <div className="execution-divider" />

                {/* Finish button */}
                <button
                  onClick={handleFinishTask}
                  className="task-finished-btn"
                  disabled={calculateProgress(currentWorkspace) === 100 || isArchived}
                >
                  {calculateProgress(currentWorkspace) === 100 ? '✓ Task Completed' : '✓ Mark Task as Finished'}
                </button>

                {recentlyDeleted.length > 0 && (
                  <div className="recently-deleted">
                    <button
                      className="recently-deleted-toggle"
                      onClick={() => setShowRecentlyDeleted(!showRecentlyDeleted)}
                    >
                      <Trash2 size={13} />
                      Recently Deleted ({recentlyDeleted.length})
                      <span className="archived-chevron">{showRecentlyDeleted ? '▲' : '▼'}</span>
                    </button>
                    {showRecentlyDeleted && (
                      <div className="recently-deleted-list">
                        {recentlyDeleted.map((item, index) => (
                          <div key={index} className="recently-deleted-item">
                            <span className="recently-deleted-title">{item.subtask.title}</span>
                            <button
                              className="restore-btn"
                              onClick={() => handleRestoreSubtask(index)}
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {currentWorkspace.subtasks.length > 0 && (
                  <div className="next-step-section">
                    <div className="next-step-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Bonus challenges</span>
                      {!bonusChallenges[currentWorkspace.id] && (
                        <button
                          className="view-toggle-btn"
                          onClick={async () => {
                            if (!ollamaRunning) return
                            setLoadingBonuses(true)
                            try {
                              const challenges = await generateBonusChallenges(
                                currentWorkspace.title,
                                currentWorkspace.description,
                                currentWorkspace.subtasks.map(s => s.title)
                              )
                              setBonusChallenges(prev => ({ ...prev, [currentWorkspace.id]: challenges }))
                            } catch {
                              // fail silently
                            } finally {
                              setLoadingBonuses(false)
                            }
                          }}
                          disabled={loadingBonuses}
                        >
                          {loadingBonuses ? 'Generating...' : 'Generate'}
                        </button>
                      )}
                    </div>

                    {!bonusChallenges[currentWorkspace.id] && !loadingBonuses && (
                      <p className="next-step-text">
                        Optional challenges to go further — click Generate to get AI suggestions tailored to your task.
                      </p>
                    )}

                    {loadingBonuses && (
                      <div className="next-step-text">Thinking of bonus challenges...</div>
                    )}

                    {bonusChallenges[currentWorkspace.id]?.map((challenge, i) => (
                      <div key={i} className="next-step-card" style={{ marginBottom: '8px' }}>
                        <div className="next-step-indicator" style={{ background: '#a855f7' }} />
                        <div style={{ flex: 1 }}>
                          <p className="next-step-title">{challenge.title}</p>
                          <p className="next-step-pts">{challenge.reason}</p>
                        </div>
                        <button
                          className="view-toggle-btn"
                          style={{ flexShrink: 0, marginLeft: '8px' }}
                          onClick={() => {
                            const newSubtask = {
                              id: Date.now(),
                              title: challenge.subtaskTitle || challenge.title,
                              done: false,
                              points: 10,
                              dependsOn: []
                            }
                            updateWorkspace(currentWorkspace.id, {
                              subtasks: [...currentWorkspace.subtasks, newSubtask]
                            })
                            setBonusChallenges(prev => ({
                              ...prev,
                              [currentWorkspace.id]: prev[currentWorkspace.id].filter((_, idx) => idx !== i)
                            }))
                          }}
                        >
                          + Add
                        </button>
                      </div>
                    ))}

                    {bonusChallenges[currentWorkspace.id]?.length === 0 && (
                      <p className="next-step-text">All bonus challenges added to your plan.</p>
                    )}

                    {bonusChallenges[currentWorkspace.id] && (
                      <button
                        className="view-toggle-btn"
                        style={{ marginTop: '8px' }}
                        onClick={async () => {
                          setLoadingBonuses(true)
                          try {
                            const challenges = await generateBonusChallenges(
                              currentWorkspace.title,
                              currentWorkspace.description,
                              currentWorkspace.subtasks.map(s => s.title)
                            )
                            setBonusChallenges(prev => ({
                              ...prev,
                              [currentWorkspace.id]: [
                                ...(prev[currentWorkspace.id] || []),
                                ...challenges
                              ]
                            }))
                          } catch {
                            // fail silently
                          } finally {
                            setLoadingBonuses(false)
                          }
                        }}
                        disabled={loadingBonuses}
                      >
                        {loadingBonuses ? 'Generating...' : 'Generate more'}
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>

</>
        ) : (
          <div className="empty-center-layout">
            <div className="empty-center-heading">
              <h2>Your workspace is ready</h2>
              <p>Create a task or project and start building your execution plan.</p>
            </div>
            <div className="center-header">
              <div className="crumbs"><span className="ghost-line" style={{width:80}} /></div>
              <div className="ghost-line" style={{width:'55%', height:32, marginTop:10, marginBottom:10, borderRadius:6}} />
              <div className="ghost-line" style={{width:'80%', height:13, marginBottom:4}} />
              <div className="ghost-line" style={{width:'60%', height:13}} />
              <div className="header-divider" />
              <div className="ghost-line" style={{width:110, height:28, borderRadius:20}} />
              <div className="progress-row" style={{marginTop:16}}>
                <span className="progress-label"><span className="ghost-line" style={{width:55, height:11}} /></span>
                <span className="progress-percent"><span className="ghost-line" style={{width:28, height:11}} /></span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{width:'0%'}} /></div>
            </div>

            <div className="execution-plan">
              <div className="execution-card">
                <div className="execution-header">
                  <span className="execution-title">Execution Plan</span>
                  <div className="ghost-line" style={{width:72, height:26, borderRadius:6}} />
                </div>
                <div className="execution-divider" />
                <div className="empty-ghost-nodes">
                  <div className="ghost-node bouncing" style={{animationDelay:'0s'}} /><div className="ghost-arrow" />
                  <div className="ghost-node bouncing" style={{animationDelay:'0.15s'}} /><div className="ghost-arrow" />
                  <div className="ghost-node bouncing" style={{animationDelay:'0.3s'}} /><div className="ghost-arrow" />
                  <div className="ghost-node bouncing" style={{animationDelay:'0.45s'}} />
                </div>
              </div>
            </div>

            <div className="execution-plan" style={{marginTop:0}}>
              <div className="execution-card">
                <div className="ghost-subtask-row" />
                <div className="ghost-subtask-row" style={{width:'75%'}} />
                <div className="ghost-subtask-row" />
              </div>
            </div>

            <div className="empty-center-cta">
              <p>No task selected — press <strong>+</strong> to create one</p>
            </div>
          </div>
        )}
      </main>

      <aside
        className={`assistant assistant-panel ${assistantCollapsed ? 'collapsed' : ''} ${centerLoading ? 'assistant-loading' : ''}`}
        style={assistantCollapsed ? undefined : { flex: `0 0 ${assistantWidth}px`, width: assistantWidth, minWidth: assistantWidth, maxWidth: assistantWidth }}
      >
        <div className="assistant-resize-handle" onMouseDown={handleResizeStart} />
        <button
          className="assistant-toggle-btn"
          onClick={() => setAssistantCollapsed(prev => !prev)}
        >
          <ChevronRight size={14} />
        </button>

        <div className="assistant-content">
        <div className="assistant-header">
          <div className="assistant-title">Task Assistant</div>
          <div className="modes" style={{marginTop: 10}}>
            <span
              className={`mode ${assistantMode === 'questioning' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('questioning')}
              style={{ cursor: 'pointer' }}
            >
              QUESTIONING
            </span>
            <span
              className={`mode ${assistantMode === 'planning' ? 'active' : ''} ${planningTabPulse ? 'pulse-tab' : ''}`}
              onClick={() => { handleModeSwitch('planning'); setPlanningTabPulse(false) }}
              style={{ cursor: 'pointer' }}
            >
              PLANNING
            </span>
            <span
              className={`mode ${assistantMode === 'execution' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('execution')}
              style={{ cursor: 'pointer' }}
            >
              EXECUTION
            </span>
            <span
              className={`mode ${assistantMode === 'review' ? 'active' : ''} ${reviewTabPulse ? 'pulse-tab' : ''}`}
              onClick={() => { handleModeSwitch('review'); setReviewTabPulse(false) }}
              style={{ cursor: 'pointer' }}
            >
              REVIEW
            </span>
          </div>
        </div>

        {ollamaRunning === false && (
          <div className="ollama-warning">
            ⚠️ Ollama not running
          </div>
        )}

        <div className="assistant-body" ref={assistantBodyRef}>
          {!currentWorkspace && assistantMessages.length === 0 && (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon">TQ</div>
              <p className="assistant-welcome-title">TaskQuest Assistant</p>
              <p className="assistant-welcome-sub">Create a task or project and I'll help you plan, execute and review it step by step.</p>
            </div>
          )}
          {assistantMessages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              {msg.role === 'assistant' && (
                <div className="assistant-avatar">TQ</div>
              )}
              <div className="message-bubble">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isAILoading && (
            <div className="chat-message assistant-message">
              <div className="assistant-avatar">TQ</div>
              <div className="message-bubble ai-loading-dots">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <div className="assistant-upload">
          <label className="upload-btn">
              {uploadedFileName || 'Upload PDF or Word doc'}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleDocumentUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <button
          className="clear-chat-btn"
          onClick={() => setAssistantMessages([])}
          title="Clear chat"
          disabled={assistantMessages.length === 0}
        >
          Clear chat
        </button>
        <div className="assistant-input">
          <textarea
            placeholder={ollamaRunning ? "Describe your task..." : "Start Ollama to use AI..."}
            value={assistantInput}
            onChange={e => {
              setAssistantInput(e.target.value)
              e.target.style.height = '52px'
              const newHeight = Math.min(e.target.scrollHeight, 350)
              e.target.style.height = newHeight + 'px'
              if (newHeight >= 350) {
                e.target.classList.add('scrollable')
              } else {
                e.target.classList.remove('scrollable')
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAssistantSend()
              }
            }}
            disabled={!ollamaRunning || isAILoading}
            rows={2}
          />
          <button
            className="assistant-send-btn"
            onClick={handleAssistantSend}
            disabled={!ollamaRunning || isAILoading}
          >
            <ArrowUp size={18} />
          </button>
        </div>
        </div>

      </aside>

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowSettings(false)}>
          <div className="modal settings-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
            </div>
            <div className="modal-body">

              <div className="settings-section">
                <label className="settings-label">AI Provider</label>
                <select
                  className="settings-select"
                  value={apiProvider}
                  onChange={e => {
                    setApiProvider(e.target.value)
                    localStorage.setItem('apiProvider', e.target.value)
                  }}
                >
                  <option value="ollama">Local (Ollama)</option>
                  <option value="anthropic">Claude API (Anthropic)</option>
                  <option value="openai">OpenAI API</option>
                </select>
              </div>

              {apiProvider === 'ollama' && (
                <div className="settings-section">
                  <label className="settings-label">Local Model</label>
                  <select
                    className="settings-select"
                    value={selectedModel}
                    onChange={e => {
                      setSelectedModel(e.target.value)
                      localStorage.setItem('selectedModel', e.target.value)
                    }}
                  >
                    <option value="qwen2.5:7b">qwen2.5:7b (recommended)</option>
                    <option value="llama3.1:8b">llama3.1:8b</option>
                    <option value="mistral:7b">mistral:7b</option>
                    <option value="qwen2.5:14b">qwen2.5:14b (best quality)</option>
                  </select>
                </div>
              )}

              {(apiProvider === 'anthropic' || apiProvider === 'openai') && (
                <div className="settings-section">
                  <label className="settings-label">
                    API Key
                    <span className="settings-hint"> (stored locally, never sent anywhere)</span>
                  </label>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder={apiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                    value={apiKey}
                    onChange={e => {
                      setApiKey(e.target.value)
                      localStorage.setItem('apiKey', e.target.value)
                    }}
                  />
                </div>
              )}

              <div className="settings-section">
                <label className="settings-label">AI Style</label>
                <select className="settings-select" defaultValue="learning">
                  <option value="learning">Learning (Socratic — default)</option>
                  <option value="guided">Guided (balanced)</option>
                  <option value="professional">Professional (direct)</option>
                </select>
                <p className="settings-hint">More styles coming soon</p>
              </div>

              <div className="modal-actions">
                <button className="btn primary" onClick={() => setShowSettings(false)}>
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE MODAL */}
      {showArchiveModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowArchiveModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎉 Task Completed!</h3>
              <p>Would you like to move this task to the archive?</p>
            </div>
            <div className="modal-body">
              <div className="modal-actions">
                <button
                  className="btn ghost"
                  onClick={() => setShowArchiveModal(false)}
                >
                  Keep Active
                </button>
                <button
                  className="btn primary"
                  onClick={() => handleArchiveWorkspace(selectedWorkspaceId)}
                >
                  Move to Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          CREATE MODAL (Add Task/Project)
          ======================================================= */}
      {isCreateOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIsCreateOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Task / Project</h3>
              <p>Describe your task and let AI improve it.</p>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createWorkspace({
                  title: modalTitle || String(fd.get('title') || ''),
                  description: modalDescription || String(fd.get('description') || ''),
                  type: (fd.get('type') as 'task' | 'project') || 'task'
                })
                setModalTitle('')
                setModalDescription('')
              }}
            >
              <div className="field modal-field">
                <label>Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Fix memory leak"
                  value={modalTitle}
                  onChange={e => setModalTitle(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="field modal-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Description <span style={{ fontWeight: 400, opacity: 0.6 }}>(messy is OK)</span></label>
                  <button
                    type="button"
                    className={`improve-ai-icon-btn ${isImprovingAI ? 'loading' : ''}`}
                    onClick={handleImproveWithAI}
                    disabled={!ollamaRunning || isImprovingAI || !modalDescription.trim()}
                    title={ollamaRunning ? 'Improve with AI' : 'Start Ollama to use AI'}
                  >
                    <Sparkles size={15} />
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  {isImprovingAI && (
                    <div className="improve-loading-overlay">
                      <div className="improve-loading-spinner" />
                      <span>AI is improving...</span>
                    </div>
                  )}
                  <textarea
                    name="description"
                    placeholder="Paste notes here... e.g. need to finish ml coursework, implement model, write report"
                    value={modalDescription}
                    onChange={e => {
                      setModalDescription(e.target.value)
                      e.target.style.height = 'auto'
                      const newHeight = Math.min(e.target.scrollHeight, 260)
                      e.target.style.height = newHeight + 'px'
                      e.target.style.overflowY = newHeight >= 260 ? 'scroll' : 'hidden'
                    }}
                    className="modal-textarea"
                    style={{ opacity: isImprovingAI ? 0.4 : 1, padding: '12px 14px' }}
                  />
                </div>
              </div>

              {!ollamaRunning && (
                <p className="improve-ai-warning">Start Ollama to use AI improvement</p>
              )}

              <label className="field">
                <span>Type</span>
                <select name="type" defaultValue="task">
                  <option value="task">Task (same-day)</option>
                  <option value="project">Project (multi-day)</option>
                </select>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setIsCreateOpen(false)
                    setModalTitle('')
                    setModalDescription('')
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Create
                </button>
              </div>
            </form>



          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification.show && (
        <div className="notification-toast">
          <span className="toast-fire">🔥</span>
          {notification.message}
        </div>
      )}

    </div>
  )
}
