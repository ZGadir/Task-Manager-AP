Task & Project Manager – Prototype
Final Year Project (IPD Milestone 1)

Student: Gadir Zamanbayov
Module: 6COSC023W – Final Year Project

Project Overview
This project is a desktop task and project management application designed to help users stay focused, break down complex tasks, and track progress over time.

Instead of treating tasks as simple checkboxes, each task or project acts as a persistent workspace. The system is designed to later integrate an AI assistant that asks questions, breaks tasks into subtasks, and supports the user throughout completion.

This repository contains the working prototype and initial implementation for IPD Milestone 1.

Current Prototype Features

Desktop application built with Electron

Task and project creation

Left-side workspace list

Central task workspace view

Progress tracking per task

Gamification foundations (points and progress)

Responsive UI layout

Not implemented yet (planned for later milestones):

AI assistant logic

Calendar integration

Design Principles

Minimal friction when creating tasks

Tasks are treated as workspaces, not one-click completions

Offline-first desktop application

Subtle gamification to improve motivation

AI-driven workflow planned for future development

Technology Stack

Electron (desktop application framework)

React with TypeScript (UI and logic)

Vite (build tooling)

Custom CSS (layout and styling)

Project Structure (Key Files)

src/App.tsx – Main UI and layout logic

src/App.css – Application styling

electron/main.ts – Electron main process

electron/preload.ts – Secure preload bridge

Build outputs are intentionally ignored from version control.

Running the Prototype
npm install
npm run dev

Future Work

AI assistant integration for task breakdown

Task-scoped AI memory

File-based context analysis (PDFs, code files)

Calendar-aware project scheduling

First-time user tutorial

Persistent user data and settings

Submission Context
This repository is submitted as part of:

Prototype code (GitHub link)

Video demonstration (5–10 minutes)

Video presentation (20 minutes)

If you want, I can also:

tighten this to match marking criteria wording

write the Blackboard submission text

or sanity-check everything before final upload
