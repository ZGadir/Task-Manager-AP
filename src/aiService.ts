// src/aiService.ts
// Handles all communication with Ollama local AI

const OLLAMA_URL = 'http://localhost:11434/api/chat'
const MODEL = 'qwen2.5:7b'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Check if Ollama is running
export async function checkOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    return response.ok
  } catch {
    return false
  }
}

// Send messages to Ollama and get a response
export async function sendToAI(messages: Message[]): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error('Failed to connect to Ollama')
  }

  const data = await response.json()
  return data.message.content
}

// Generate subtasks from a task description
export async function generateSubtasks(
  taskTitle: string,
  taskDescription: string,
  documentContent?: string
): Promise<{ subtasks: string[], reasoning: string }> {
  const systemPrompt = `You are TaskQuest AI assistant. Your job is to break down tasks into clear, actionable subtasks.

When given a task you must:
1. Generate between 3 and 8 specific subtasks
2. Make each subtask clear and actionable
3. Order them logically from first to last
4. Explain your reasoning briefly

You must respond in this exact JSON format:
{
  "subtasks": ["subtask 1", "subtask 2", "subtask 3"],
  "reasoning": "Brief explanation of why you chose these subtasks"
}

Only respond with the JSON. No other text.`

  const userMessage = documentContent
    ? `Task: ${taskTitle}\n\nDescription: ${taskDescription}\n\nDocument content:\n${documentContent.slice(0, 3000)}`
    : `Task: ${taskTitle}\n\nDescription: ${taskDescription}`

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]

  const response = await sendToAI(messages)

  try {
    // Clean response in case model adds extra text
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      subtasks: parsed.subtasks || [],
      reasoning: parsed.reasoning || ''
    }
  } catch {
    // Fallback if JSON parsing fails
    return {
      subtasks: [response],
      reasoning: 'Could not parse structured response'
    }
  }
}

// Ask a clarifying question about the task
export async function askClarifyingQuestion(
  taskTitle: string,
  taskDescription: string,
  conversationHistory: Message[]
): Promise<string> {
  const systemPrompt = `You are TaskQuest AI assistant. You help users break down their tasks.

Your job right now is to ask ONE short clarifying question to better understand the task before generating subtasks.

Rules:
- Ask only ONE question
- Keep it short and simple
- Focus on what matters most for breaking down the task
- Do not ask multiple questions at once`

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `I need help breaking down this task:\n\nTitle: ${taskTitle}\nDescription: ${taskDescription}`
    },
    ...conversationHistory
  ]

  return await sendToAI(messages)
}
