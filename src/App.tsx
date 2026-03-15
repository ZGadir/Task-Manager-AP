// src/App.tsx
// ===============================
// MAIN APP FILE (3-column layout)
// Left  = Workspaces (Tasks/Projects list)
// Middle= Selected workspace details
// Right = Assistant panel (UI only for now)
// ===============================

import { useState, useEffect, type MouseEvent } from 'react'
import './App.css'
import { Plus, Moon, Sun, MoreHorizontal, Archive, Trash2 } from 'lucide-react'
import { Workspace, Subtask } from './types'

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
    const saved = localStorage.getItem('workspaces')
    if (saved) return JSON.parse(saved)
    return [
      {
        id: 1,
        type: 'task',
        title: 'Prepare Quarterly Report',
        description: 'Summarize financial performance and team KPIs.',
        subtasks: [
          { id: 1, title: 'Gather Q4 data', done: false, points: 100 },
          { id: 2, title: 'Create charts', done: false, points: 150 },
          { id: 3, title: 'Write executive summary', done: false, points: 200 },
        ],
        points: 0,
        progress: 0,
      },
      {
        id: 2,
        type: 'project',
        title: 'Redesign Q1 Landing Page',
        description: 'Update hero section + CTA buttons for better conversion.',
        subtasks: [
          { id: 1, title: 'Analyze current conversion metrics', done: false, points: 100 },
          { id: 2, title: 'Create wireframes for new hero section', done: false, points: 150 },
          { id: 3, title: 'Design CTA button variations', done: false, points: 100 },
        ],
        points: 0,
        progress: 0,
      },
    ]
  })
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(1)
  // ===============================
  // STATE: Create Task/Project Modal
  // ===============================
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [recentlyDeleted, setRecentlyDeleted] = useState<{
    subtask: Subtask
    workspaceId: number
    timestamp: number
  }[]>([])
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false)
  const [archivedWorkspaces, setArchivedWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('archivedWorkspaces')
    if (saved) return JSON.parse(saved)
    return []
  })
  const [showArchived, setShowArchived] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true'
  })

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
    localStorage.setItem('archivedWorkspaces', JSON.stringify(archivedWorkspaces))
  }, [archivedWorkspaces])

  // Get current workspace
  const currentWorkspace =
    workspaces.find(w => w.id === selectedWorkspaceId) ||
    archivedWorkspaces.find(w => w.id === selectedWorkspaceId);
  const isArchived = archivedWorkspaces.some(w => w.id === selectedWorkspaceId);

  // Calculate total points across all workspaces
  const totalOverallPoints = workspaces.reduce((sum, w) => sum + w.points, 0);

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
      points: 50
    };
    
    const updatedSubtasks = [...(currentWorkspace.subtasks || []), newSubtask];
    updateWorkspace(selectedWorkspaceId, { subtasks: updatedSubtasks });
    setNewSubtaskTitle("");
  };

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

  const handleToggleSubtask = (subtaskId: number) => {
    if (!currentWorkspace) return;

    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(workspace => {
        if (workspace.id !== selectedWorkspaceId) return workspace;

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
                w.id === selectedWorkspaceId 
                  ? { ...w, points: w.points + 100 }
                  : w
              ));
            }, 1500);
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
    if (selectedWorkspaceId === workspaceId) {
      setSelectedWorkspaceId(remaining[0].id);
    }
  };

  const handleSelectWorkspace = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    setNewSubtaskTitle(""); // Clear input when switching
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
  }

  // ===============================
  // FUTURE: place new logic here later
  // - Rename workspace
  // - Delete workspace
  // - Add subtasks + points system
  // - Save/load from disk (Electron FS)
  // ===============================

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
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

          {/* NEW: Plus button opens Create modal */}
          <button
            className="icon-btn"
            title="New Task / Project"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={18} />
          </button>
          <button
            className="icon-btn"
            title="Toggle Dark Mode"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Overall points display */}
        <div className="overall-points">
          <DiamondIcon size={28} color="white" />
          <span className="points-value">{totalOverallPoints}</span>
          <span className="points-label">Total Points</span>
        </div>

        <div className="workspace-list">
          {/* Empty state */}
          {workspaces.length === 0 && <div className="empty-left">No tasks yet</div>}

          {/* List is NOT hard-coded; it comes from state */}


          {workspaces.map((workspace) => (
            <div 
              key={workspace.id}
              className={`workspace-item ${workspace.type} ${selectedWorkspaceId === workspace.id ? 'selected' : ''}`}
              onClick={() => handleSelectWorkspace(workspace.id as number)}
            >
              <div className="workspace-header">
                <span className="workspace-type">{workspace.type.toUpperCase()}</span>
                <button
                  className="workspace-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === workspace.id ? null : workspace.id)
                  }}
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
                        handleArchiveWorkspace(workspace.id)
                        setOpenMenuId(null)
                      }}
                    >
                      <Archive size={14} /> Archive
                    </button>
                    <button
                      className="workspace-dropdown-item delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteWorkspace(e as MouseEvent<HTMLButtonElement>, workspace.id)
                        setOpenMenuId(null)
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
                  <DiamondIcon size={11} color="#6366f1" /> {workspace.points} pts
                </span>
                <span className="workspace-progress-text">{workspace.progress}%</span>
              </div>
              <div className="workspace-progress-bar">
                <div 
                  className="workspace-progress-fill" 
                  style={{ width: `${workspace.progress}%` }}
                ></div>
              </div>
            </div>
          ))}
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
        </div>
      </aside>

      {/* =======================================================
          MIDDLE PANEL (CENTER): Selected workspace view
          ======================================================= */}

      <main className="center">
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
                  <DiamondIcon size={14} color="#f97316" /> {currentWorkspace.points} pts earned
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
                  <h2>Execution Plan</h2>
                  {currentWorkspace.subtasks.length === 0 && (
                    <span className="no-subtasks-pill">No subtasks yet</span>
                  )}
                </div>

                <div className="execution-divider" />

                {/* Empty state */}
                {currentWorkspace.subtasks.length === 0 && (
                  <p className="execution-empty">No subtasks added yet — add one below.</p>
                )}

                {/* Subtasks list */}
                <div className="subtasks-list">
                  {currentWorkspace.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className={`subtask-item ${subtask.done ? 'completed' : ''}`}
                      onClick={() => handleToggleSubtask(subtask.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={() => handleToggleSubtask(subtask.id)}
                        className="subtask-checkbox"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="subtask-title">{subtask.title}</span>
                      <span className="subtask-points">
                        <DiamondIcon size={11} color="#6366f1" /> +{subtask.points} pts
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
                  ))}
                </div>

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

                {/* Recently Deleted */}
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

                {/* Activity Log */}
                <div className="activity-log">
                  <h3>Activity Log</h3>
                  <p className="activity-empty">Completed subtasks will appear here</p>
                </div>

              </div>
            </div>

            {/* FUTURE: Put subtasks UI + log timeline here */}

          </>
        ) : (
          <div className="section">
            <div className="empty-card">Select a workspace from the left.</div>
          </div>
        )}
      </main>

      {/* =======================================================
          RIGHT PANEL (ASSISTANT): UI only for now (no AI yet)
          ======================================================= */}
      <aside className="assistant">
        <div className="assistant-header">
          <div className="assistant-title">Task Assistant</div>

          <div className="modes">
            <span className="mode active">QUESTIONING</span>
            <span className="mode">PLANNING</span>
            <span className="mode">EXECUTION</span>
            <span className="mode">REVIEW</span>
          </div>
        </div>

        <div className="assistant-body">
          <div className="card">
            <p>
              <b>UI only:</b> assistant comes later.
            </p>
            <p className="muted">No internet. Uses only your info.</p>

            {/* FUTURE: Put chat messages + file list here */}

            
          </div>
        </div>

        <div className="assistant-input">
          <input placeholder="Type here (disabled for now)..." disabled />
          <button disabled>→</button>
        </div>
      </aside>

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
              <p>Minimal input now — details later.</p>
            </div>

            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createWorkspace({
                  title: String(fd.get('title') || ''),
                  description: String(fd.get('description') || ''),
                  type: (fd.get('type') as 'task' | 'project') || 'task'
                })
              }}
            >
              <label className="field">
                <span>Title</span>
                <input name="title" required placeholder="e.g., Fix memory leak" />
              </label>

              <label className="field">
                <span>Description (messy is OK)</span>
                <textarea name="description" rows={4} placeholder="Paste notes here..." />
              </label>

              <label className="field">
                <span>Type</span>
                <select name="type" defaultValue="task">
                  <option value="task">Task (same-day)</option>
                  <option value="project">Project (multi-day)</option>
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Create
                </button>
              </div>
            </form>

            {/* FUTURE: Add file upload into modal here (optional) */}


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
