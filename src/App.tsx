// src/App.tsx
// ===============================
// MAIN APP FILE (3-column layout)
// Left  = Workspaces (Tasks/Projects list)
// Middle= Selected workspace details
// Right = Assistant panel (UI only for now)
// ===============================

import { useState } from 'react'
import './App.css'
import { Plus } from 'lucide-react'


// ===============================
// TYPES (DATA MODEL)
// ===============================
interface Subtask {
  id: number
  title: string
  done: boolean
  points: number
}

interface Workspace {
  id: number
  type: 'task' | 'project'
  title: string
  description: string
  subtasks: Subtask[]
  points: number
  progress: number
}


export default function App() {
  // ===============================
  // STATE: Workspaces + Selection
  // ===============================
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 1,
      type: 'task',
      title: 'Prepare Quarterly Report',
      description: 'Summarize financial performance and team KPIs.',
      subtasks: [
        { id: 1, title: "Gather Q4 data", done: false, points: 100 },
        { id: 2, title: "Create charts", done: false, points: 150 },
        { id: 3, title: "Write executive summary", done: false, points: 200 },
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
        { id: 1, title: "Analyze current conversion metrics", done: false, points: 100 },
        { id: 2, title: "Create wireframes for new hero section", done: false, points: 150 },
        { id: 3, title: "Design CTA button variations", done: false, points: 100 },
      ],
      points: 0,
      progress: 0,
    }
  ])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(1)
  // ===============================
  // STATE: Create Task/Project Modal
  // ===============================
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [notification, setNotification] = useState<{message: string; show: boolean}>({message: '', show: false})  // eslint-disable-next-line @typescript-eslint/no-unused-vars  const [completedTasksStreak, setCompletedTasksStreak] = useState(0)

  // Get current workspace
  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

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
              showNotification(`🔥 You're on a streak! +100 bonus points`);
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
    <div className="app">
      {/* =======================================================
          LEFT PANEL (SIDEBAR): Workspaces list + Add button
          ======================================================= */}

          
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">⚡</div>
          <div className="title">Workspaces</div>

          {/* NEW: Plus button opens Create modal */}
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
          <span className="points-icon">⚡</span>
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
                <span className="workspace-title">{workspace.title}</span>
              </div>
              <div className="workspace-stats">
                <span className="workspace-points">{workspace.points} pts</span>
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
              </div>

              <h1>{currentWorkspace.title}</h1>
              <p>{currentWorkspace.description}</p>

              <div className="header-divider" />

              <div className="header-stats">
                <span className="pts-badge">
                  ⚡ {currentWorkspace.points} pts earned
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
                    >
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleToggleSubtask(subtask.id)
                        }}
                        className="subtask-checkbox"
                      />
                      <span className="subtask-title">{subtask.title}</span>
                      <span className="subtask-points">+{subtask.points} pts</span>
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
                  disabled={calculateProgress(currentWorkspace) === 100}
                >
                  {calculateProgress(currentWorkspace) === 100 ? '✓ Task Completed' : '✓ Mark Task as Finished'}
                </button>

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
          {notification.message}
        </div>
      )}

    </div>
  )
}
