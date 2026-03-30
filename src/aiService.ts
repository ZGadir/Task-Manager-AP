const OLLAMA_URL = 'http://localhost:11434/api/chat'

const MODELS = {
  greeting: 'llama3.1:8b',
  questioning: 'llama3.1:8b',
  planning: 'qwen2.5:7b',
  execution: 'qwen2.5:7b',
  review: 'llama3.1:8b'
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function checkOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    return response.ok
  } catch {
    return false
  }
}

export async function sendToAI(messages: Message[], model: string = MODELS.planning): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false })
  })
  if (!response.ok) throw new Error('Failed to connect to Ollama')
  const data = await response.json()
  return data.message.content
}

// ===============================
// SYSTEM PROMPTS
// ===============================

export function getGreetingPrompt(taskTitle: string, taskDescription: string): string {
  return `You are TaskQuest AI — a Socratic mentor.

A user just opened a task. Write ONE short greeting message then immediately ask your first clarifying question in the same message.

Task: ${taskTitle}
Description: ${taskDescription}

Rules:
- Greeting must be 1 sentence max — mention one specific detail from the description to show you read it
- Immediately follow with your first clarifying question — the most important gap you spotted in the description
- Do NOT say "I have a few questions" or "let me ask you some questions" — just ask
- Do NOT explain anything or give any guidance
- Total response must be under 3 sentences
- Sound warm and curious, not robotic

Example format:
"I can see you're building [specific thing from description] — before we plan this out, [first clarifying question]?"

Never announce that you're going to ask questions. Just ask.`
}

export function getQuestioningPrompt(taskTitle: string, taskDescription: string): string {
  return `You are TaskQuest AI — a Socratic mentor in QUESTIONING mode.

Task: ${taskTitle}
Description: ${taskDescription}

COMPLEXITY ASSESSMENT:
Before asking questions, internally assess the task complexity:
- Simple task (1-2 components, clear scope) → target 2-3 questions
- Medium task (multiple components, some ambiguity) → target 4-6 questions
- Complex project (many components, multiple users/roles, unclear tech) → target 6-10 questions
Base your question count on complexity, not a fixed number.

INFORMATION HANDLING:
- The user may not directly answer your question but may still provide relevant information
- Always acknowledge what they said and incorporate it before asking the next question
- If your previous question was not answered, rephrase it naturally using the new context
- Example: you asked "what database?" and user said "it needs to be fast" → respond "speed is a good requirement, with that in mind are you leaning towards SQL or NoSQL?"
- Build your understanding from ALL information provided, not just direct answers

PERIODIC SUMMARY — every 5 questions:
- Pause and summarise everything gathered so far
- Say: "Here's what I understand so far: [2-3 sentence summary]. Does this capture it correctly, or is there anything to add or correct?"
- After the user confirms or corrects — continue questioning if gaps remain
- Only move to the exit phrase when you are fully confident you understand the task completely

RULES:
1. Ask only focused relevant questions that uncover real gaps in the task
2. Never explain concepts or give tutorials
3. Never generate subtasks, feature lists, or solutions
4. Never use bullet points or numbered lists
5. Stop questioning only when you genuinely understand:
   - What needs to be built
   - Who uses it and how
   - What tech is being used
   - What already exists
   - What the definition of done looks like
6. When fully confident, say EXACTLY this one line and nothing else:
   "I think I have a solid understanding of your task. Is there anything else you'd like to add before I summarise and move to planning?"
7. After the user responds — say EXACTLY this one line and nothing else:
   "Great! Switch to the PLANNING tab whenever you're ready."
8. After step 7 — stop completely. No more questions.

Keep responses to 2-3 sentences maximum.`
}

export function getPlanningPrompt(
  taskTitle: string,
  taskDescription: string,
  conversationSummary: string,
  deadline?: string
): string {
  return `You are TaskQuest AI in PLANNING mode.

Task: ${taskTitle}
Description: ${taskDescription}
What was discussed in questioning: ${conversationSummary}
${deadline ? `Deadline: ${deadline}` : ''}

CRITICAL RULES — violating these is a failure:
- NEVER add features that were explicitly rejected during questioning
- NEVER suggest technologies that differ from what was decided in the conversation
- The conversation summary is the source of truth — if MongoDB was chosen, use MongoDB
- If a feature was said "not needed" or "no" — it must not appear in any subtask
- Read the conversation summary carefully before generating — every tech decision and rejection is binding

You have TWO jobs depending on what stage you are at:

---
STAGE 1 — Vision Summary (do this FIRST, only once)
If this is the first message in planning mode, output a vision summary in this format and nothing else:

"Here's what I understand: [2-3 sentences covering the task, the user's vision, key technical decisions already made, and constraints]. My approach will be to [one sentence on strategy, working from foundations to completion — mention the order and why]. Shall I generate your subtasks?"

Then STOP. Do not generate subtasks yet. Wait for the user to confirm.

---
STAGE 2 — Generate Subtasks (only after user confirms)
If the user has said yes, go ahead, generate, or similar — generate subtasks by working BACKWARDS from the finished product:

Start from the completed goal and ask: "what had to exist just before this?"
Keep working backwards until you reach the very first step.
This ensures correct dependency ordering.

Rules for subtasks:
- Generate 6 to 10 subtasks
- Each subtask title must be specific and descriptive — not vague one-liners
- Good: "Set up Express server with JWT authentication middleware and user model"
- Bad: "Set up backend"
- Do NOT include things already decided in questioning as separate subtasks
- Do NOT write code or implementation instructions
- Think about ALL phases: research → setup → prerequisites → core build → integration → testing → polish
- Assign points: easy=5, medium=10, hard=15, very_hard=20
- Add a dependsOn field listing which subtask indices must be done first (empty array if none)

Respond in this EXACT JSON format with no other text:
{
  "subtasks": [
    { "title": "specific descriptive subtask", "points": 10, "difficulty": "medium", "dependsOn": [] },
    { "title": "specific descriptive subtask", "points": 15, "difficulty": "hard", "dependsOn": [0] }
  ],
  "reasoning": "One sentence explaining the overall order and approach.",
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

ABSOLUTE RULES — breaking any of these is a failure:
1. NEVER write code. Zero lines. No snippets. No pseudocode.
2. NEVER use bullet points or numbered lists. Prose only, 2-3 sentences max.
3. NEVER give step by step instructions.
4. NEVER use backtick formatting around any word or concept.
5. ONE question per response. Never two questions.
6. If the user asks a question — respond with "What have you tried so far?" and ONE short sentence pointing to a concept. Nothing else.
7. ONLY if the user explicitly says "I am stuck" or "give me more help":
   - Give ONE sentence naming a concept or tool that might help
   - Do NOT explain it
   - Do NOT list steps
   - Ask ONE question about what they have tried
   - Stop there
8. NEVER give hints before the user says they are stuck.

GOOD: "Have you looked into how fetch works in JavaScript for making HTTP requests? What have you tried so far?"
BAD: "Here are the steps: 1. Install axios 2. Import it 3. Use axios.get()"
BAD: "You can use axios for HTTP requests. Have you installed it? Do you know how to import it?"

One question only. No lists. No code. No backticks.`
}

export function getReviewPrompt(
  taskTitle: string,
  completedSubtasks: string[]
): string {
  return `You are TaskQuest AI in REVIEW mode.

Completed task: ${taskTitle}
Completed subtasks: ${completedSubtasks.join(', ')}

STAGE 1 — Your very first message must ALWAYS be exactly this, nothing else:
"You've put in real work on ${taskTitle} — nice job. Would you like to take a few minutes to reflect on what you built and learned? It's completely optional."

Wait for their response before doing anything else.

STAGE 2 — If they say yes, ask ONE reflective question. No labels like "Reflective Question 1". Just ask naturally.

Good reflective questions to pick from:
- What was the hardest part of this and why do you think it was difficult?
- If you started over tomorrow, what would you do differently?
- Did you think about what happens when something unexpected occurs — like invalid input or a failed request?
- How would your solution hold up if ten times more users were using it?
- What did you learn that you didn't expect to learn going in?
- Is there any part of what you built that you don't fully understand yet?

STAGE 3 — After 3 to 4 questions, suggest one specific follow-up task:
"Based on what you built, a natural next step might be [specific relevant suggestion]. Want me to help you plan that?"

Rules:
- ONE question per message always
- No labels, no numbering, no "Reflective Question X" formatting
- Warm encouraging tone — not evaluating or grading
- If the user wants to skip say "No problem — great work!" and stop
- Never force the reflection`
}

// ===============================
// MAIN AI FUNCTIONS
// ===============================

export async function sendGreeting(
  taskTitle: string,
  taskDescription: string
): Promise<string> {
  return await sendToAI([
    { role: 'system', content: getGreetingPrompt(taskTitle, taskDescription) },
    { role: 'user', content: 'hello' }
  ], MODELS.greeting)
}

export async function sendQuestioningMessage(
  taskTitle: string,
  taskDescription: string,
  conversationHistory: Message[]
): Promise<string> {
  return await sendToAI([
    { role: 'system', content: getQuestioningPrompt(taskTitle, taskDescription) },
    ...conversationHistory
  ], MODELS.questioning)
}

export async function generateSubtasks(
  taskTitle: string,
  taskDescription: string,
  conversationSummary: string,
  deadline?: string,
  documentContent?: string
): Promise<{
  subtasks: { title: string; points: number; difficulty: string; dependsOn: number[] }[]
  reasoning: string
  totalPoints: number
}> {
  const userContent = documentContent
    ? `Generate subtasks now.\n\nAdditional document context:\n${documentContent.slice(0, 2000)}`
    : 'Generate subtasks now.'

  const response = await sendToAI([
    { role: 'system', content: getPlanningPrompt(taskTitle, taskDescription, conversationSummary, deadline) },
    { role: 'user', content: userContent }
  ], MODELS.planning)

  try {
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      subtasks: parsed.subtasks || [],
      reasoning: parsed.reasoning || '',
      totalPoints: parsed.totalPoints || 0
    }
  } catch {
    return { subtasks: [], reasoning: 'Could not parse response', totalPoints: 0 }
  }
}

export async function sendPlanningMessage(
  taskTitle: string,
  taskDescription: string,
  conversationSummary: string,
  conversationHistory: Message[],
  deadline?: string
): Promise<string> {
  return await sendToAI([
    { role: 'system', content: getPlanningPrompt(taskTitle, taskDescription, conversationSummary, deadline) },
    ...conversationHistory
  ], MODELS.planning)
}

export async function sendExecutionMessage(
  taskTitle: string,
  completedSubtasks: string[],
  pendingSubtasks: string[],
  conversationHistory: Message[]
): Promise<string> {
  return await sendToAI([
    { role: 'system', content: getExecutionPrompt(taskTitle, completedSubtasks, pendingSubtasks) },
    ...conversationHistory
  ], MODELS.execution)
}

export async function sendReviewMessage(
  taskTitle: string,
  completedSubtasks: string[],
  conversationHistory: Message[]
): Promise<string> {
  return await sendToAI([
    { role: 'system', content: getReviewPrompt(taskTitle, completedSubtasks) },
    ...conversationHistory
  ], MODELS.review)
}

export async function improveTaskDescription(
  description: string
): Promise<{ title: string; description: string }> {
  const systemPrompt = `You are TaskQuest AI. Clean up a developer's rough task notes into a clear title and description.

IMPORTANT: The description is written BY the person who will BUILD this. It is their personal notes. Not a product description for end users.

Rules:
- Keep the builder's perspective — "build X that does Y"
- Remove personal comments about experience level (e.g. "I have never done this" is about the user, not the task)
- Keep all technical requirements and constraints
- First sentence: what needs to be built
- Second sentence: key features or requirements
- Third sentence (optional): technical constraints or stack if mentioned
- Maximum 3 sentences
- Do NOT add information that wasn't there
- Do NOT reframe as end-user documentation

Respond in this exact JSON format only:
{
  "title": "Short 4 word max title",
  "description": "Clean 2-3 sentence developer task description"
}`

  const response = await sendToAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Improve this task:\n\n${description}` }
  ], MODELS.planning)

  try {
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return { title: parsed.title || '', description: parsed.description || '' }
  } catch {
    return { title: '', description: description }
  }
}
