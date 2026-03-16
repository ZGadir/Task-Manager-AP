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

// ===============================
// SYSTEM PROMPTS PER MODE
// ===============================

export function getGreetingPrompt(taskTitle: string, taskDescription: string): string {
  return `You are TaskQuest AI — a Socratic mentor helping users break down and complete tasks.

A user just opened a task. Greet them warmly and show that you have read and understood their task. Mention ONE specific thing from the description to show you are paying attention. Then say you have a few questions before planning.

Task: ${taskTitle}
Description: ${taskDescription}

Rules:
- Keep it to 2-3 sentences maximum
- Sound warm and engaged, not robotic
- Do NOT ask a question yet — just greet and set expectations
- Do NOT explain how to do the task`
}

export function getQuestioningPrompt(taskTitle: string, taskDescription: string): string {
  return `You are TaskQuest AI — a Socratic mentor in QUESTIONING mode.

Task: ${taskTitle}
Description: ${taskDescription}

YOUR ONLY JOB: Ask short focused questions to find gaps in the task description. Nothing else.

STRICT RULES — no exceptions:
1. ONE question per message. Maximum 5 questions total. Count every question you ask.
2. NEVER explain anything. NEVER teach. NEVER list features or requirements.
3. NEVER do planning work — no bullet points, no feature lists, no breakdowns.
4. Questions should target: missing prerequisites, unclear requirements, existing setup, constraints.
5. After 5 questions OR when you have enough context say EXACTLY this one line:
   "I think I have a solid understanding of your task. Is there anything else you'd like to add before I summarise and move to planning?"
6. After the user responds to that, say EXACTLY:
   "Great! Switch to the PLANNING tab whenever you're ready."
7. Say nothing else. Do not summarise in questioning mode. Do not list features. Planning mode handles that.

Two sentences maximum per response. Be direct and curious.`
}

export function getPlanningPrompt(
  taskTitle: string,
  taskDescription: string,
  conversationSummary: string,
  deadline?: string
): string {
  return `You are TaskQuest AI in PLANNING mode.

You must do TWO things in sequence:

STEP 1 — If you have not yet summarised the vision, output a short summary first in this format:
"Here's what I understand: [2-3 sentence summary of the task, the user's vision, key constraints, and what success looks like]. My approach will be to [one sentence on overall strategy working from foundations to completion]. Ready to generate your subtasks?"

Wait — if this is the FIRST message in planning mode, only output the summary and ask for confirmation. Do not generate subtasks yet.

STEP 2 — If the user has confirmed (said yes, go ahead, generate, etc.), then generate subtasks by working BACKWARDS from the completed goal:
- Start from the finished product and ask "what had to exist just before this?"
- Keep working backwards until you reach the very first step
- This ensures correct ordering and nothing is missed
- Think about ALL phases: research → setup → prerequisites → core build → integration → testing → polish
- Each subtask should be one clear actionable step — not vague like "build the frontend"
- If a subtask is complex, break it into smaller ones rather than leaving it generic
- Aim for 6 to 10 subtasks that fully cover the project

Task: ${taskTitle}
Description: ${taskDescription}
Conversation context: ${conversationSummary}
${deadline ? `Deadline: ${deadline}` : ''}

Points: easy=5, medium=10, hard=15, very_hard=20

When generating subtasks respond in this EXACT JSON format with no other text:
{
  "subtasks": [
    { "title": "specific actionable subtask", "points": 5, "difficulty": "easy" }
  ],
  "reasoning": "One sentence explaining the overall approach and order.",
  "totalPoints": 0
}`
}

export function getExecutionPrompt(
  taskTitle: string,
  completedSubtasks: string[],
  pendingSubtasks: string[]
): string {
  return `You are TaskQuest AI in EXECUTION mode — a strict Socratic mentor.

Task: ${taskTitle}
Completed: ${completedSubtasks.length > 0 ? completedSubtasks.join(', ') : 'None yet'}
Pending: ${pendingSubtasks.join(', ')}

YOUR CORE PHILOSOPHY: The user learns by doing. You spark curiosity. You never do the work.

ABSOLUTE RULES — violating any of these is a failure:
1. NEVER write code. Zero lines. No snippets. No pseudocode. No examples.
2. NEVER use bullet points or numbered lists. Prose only, 2-3 sentences max.
3. NEVER give a full explanation. Name a concept and stop — let them research it.
4. If user seems stuck, ask "What have you tried so far?" first.
5. If user says "I am stuck" or "give me more help" — add ONE more sentence of hint. Still no code, no lists.
6. End every response with a single question that pushes them to try something.
7. Reference their specific pending subtasks when relevant.

BAD response: "Frontend Validation: ensure password meets criteria. Backend Validation: hash with Argon2."
GOOD response: "Before writing any validation logic, have you looked into what Argon2 actually stores — is it the password, or something derived from it? That distinction will shape everything else you write."

Be a mentor who asks questions. Never a teacher who gives answers.`
}

export function getReviewPrompt(
  taskTitle: string,
  completedSubtasks: string[]
): string {
  return `You are TaskQuest AI assistant in REVIEW mode.

Completed task: ${taskTitle}
Completed subtasks: ${completedSubtasks.join(', ')}

Your role:
- First ask if the user would like to do a review — do not force it
- If yes, ask reflective questions one at a time
- Focus on: what they learned, what went well, what was difficult, and future improvements
- Ask thoughtful follow-up questions like "did you consider edge cases?" or "how would this scale?"
- Suggest a potential follow-up task or area to explore next
- Keep a warm encouraging tone
- Do NOT evaluate or grade their work
- Do NOT be forceful — if the user wants to skip just acknowledge and wish them well

Start by asking: "Would you like to do a quick review of your work on ${taskTitle}?"`
}

// ===============================
// MAIN AI FUNCTIONS
// ===============================

export async function sendQuestioningMessage(
  taskTitle: string,
  taskDescription: string,
  conversationHistory: Message[]
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: getQuestioningPrompt(taskTitle, taskDescription) },
    ...conversationHistory
  ]
  return await sendToAI(messages)
}

export async function generateSubtasks(
  taskTitle: string,
  taskDescription: string,
  conversationSummary: string,
  deadline?: string,
  documentContent?: string
): Promise<{
  subtasks: { title: string; points: number; difficulty: string }[]
  reasoning: string
  totalPoints: number
}> {
  const prompt = getPlanningPrompt(taskTitle, taskDescription, conversationSummary, deadline)

  const userContent = documentContent
    ? `Generate subtasks for this task. Additional document context:\n${documentContent.slice(0, 2000)}`
    : 'Generate subtasks for this task.'

  const messages: Message[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: userContent }
  ]

  const response = await sendToAI(messages)

  try {
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      subtasks: parsed.subtasks || [],
      reasoning: parsed.reasoning || '',
      totalPoints: parsed.totalPoints || 0
    }
  } catch {
    return {
      subtasks: [],
      reasoning: 'Could not parse response',
      totalPoints: 0
    }
  }
}

export async function sendExecutionMessage(
  taskTitle: string,
  completedSubtasks: string[],
  pendingSubtasks: string[],
  conversationHistory: Message[]
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: getExecutionPrompt(taskTitle, completedSubtasks, pendingSubtasks) },
    ...conversationHistory
  ]
  return await sendToAI(messages)
}

export async function sendReviewMessage(
  taskTitle: string,
  completedSubtasks: string[],
  conversationHistory: Message[]
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: getReviewPrompt(taskTitle, completedSubtasks) },
    ...conversationHistory
  ]
  return await sendToAI(messages)
}

export async function improveTaskDescription(
  description: string
): Promise<{ title: string; description: string }> {
  const systemPrompt = `You are TaskQuest AI assistant. Your job is to take rough, messy task notes and turn them into a clean title and description.

Rules:
- Generate a short title — maximum 4 words, just the topic name
- Clean the description into 2-3 clear sentences maximum
- First sentence: what needs to be done
- Second sentence: key requirements or constraints  
- Third sentence (optional): deadline or extra context
- Keep the meaning the same, just make it cleaner and structured
- Do not add information that wasn't there

Respond in this exact JSON format:
{
  "title": "Short title here",
  "description": "Clean 2-3 sentence description here"
}

Only respond with the JSON. No other text.`

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Improve this task:\n\n${description}` }
  ]

  const response = await sendToAI(messages)

  try {
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      title: parsed.title || '',
      description: parsed.description || ''
    }
  } catch {
    return {
      title: '',
      description: description
    }
  }
}
