# TaskQuest

An AI-powered desktop task management app that helps users break down tasks into subtasks using a Socratic AI mentor, track progress through gamification, and reflect on completed work.

## Requirements

- Windows 10 or later
- [Ollama](https://ollama.ai) installed and running locally
- At least 8GB RAM recommended

## Installation

1. Download `TaskQuest-Setup.exe` from the [releases page](https://github.com/ZGadir/Task-Manager-AP/releases/tag/v1.0.0)
2. Run the installer and follow the steps
3. Install Ollama from https://ollama.ai
4. Open terminal and run:
```
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
```
5. Start Ollama:
```
ollama serve
```
6. Launch TaskQuest from your desktop

## Running from source

If you prefer to run from source:

1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Install and start Ollama (see above)
4. Run the app:
```
npm run dev
```

## Usage

1. Click **+** to create a new task or project
2. Describe your task — the AI will ask clarifying questions
3. Switch to **Planning** tab — AI generates a structured subtask plan
4. Work through subtasks in **Execution** tab with AI guidance
5. Reflect on your work in **Review** tab
6. Earn points by completing subtasks

## AI Models Used

- `llama3.1:8b` — questioning, review, and greeting phases
- `qwen2.5:7b` — planning and execution phases

## Optional: Use your own API key

Open Settings (gear icon in sidebar) to switch from local Ollama to Claude or OpenAI API for better AI quality.

## Repository

https://github.com/ZGadir/Task-Manager-AP

## Video Demo

https://youtu.be/8jIJgWFBY2M
