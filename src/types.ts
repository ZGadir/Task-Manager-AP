// src/types.ts

export interface Subtask {
  id: number
  title: string
  done: boolean
  points: number
  dependsOn?: number[]
}

export interface AssistantMessage {
  role: 'assistant' | 'user'
  content: string
}

export interface AssistantState {
  messages: AssistantMessage[]
  mode: 'questioning' | 'planning' | 'execution' | 'review'
  isLoading: boolean
}

export interface Workspace {
  id: number
  type: 'task' | 'project'
  title: string
  description: string
  subtasks: Subtask[]
  points: number
  progress: number
  assistantState?: AssistantState
}
