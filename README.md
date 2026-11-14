Dear Past Me
Your memories. Your words. Your answers.

A private, voice-first journal for keeping notes to yourself and finding them again when you need them.

Live App: https://past-me-production.up.railway.app

Project Overview

Dear Past Me is a personal, voice-first journaling application designed to help people capture their thoughts today and reconnect with them in the future.

Users can write or speak journal entries, ask questions about their past experiences, and retrieve relevant excerpts directly from their saved entries. Instead of generating or guessing memories, the application grounds its answers in the user's actual words, displaying relevant excerpts along with dates and source references. If no matching information exists, it clearly says so rather than inventing an answer.

The application also allows users to leave notes for their future selves and schedule when they would like to revisit them.

Key Features
Write or Speak: Create journal entries using text or voice.
Ask Your Past: Ask natural-language questions and find relevant information from saved journal entries.
Grounded Answers: Retrieve actual journal excerpts with dates and source references instead of generating artificial memories.
Multilingual Voice Support: Record and listen in 10 languages: English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, and Punjabi.
Notes to Your Future Self: Write personal notes and schedule reminders to revisit them.
Sample Memories: Explore the application using sample entries, which can be deleted.
Gnani AI Technology Integration

Gnani AI powers the voice interaction experience in Dear Past Me, making journaling and revisiting personal memories more natural and accessible.

1. Speech-to-Text (STT v3)

Gnani's STT v3 API converts spoken journal entries into text. The application uses the selected language code to support voice input across all ten supported languages.

Endpoint: https://api.vachana.ai/stt/v3

2. Text-to-Speech (Timbre v2.5)

Gnani's Timbre v2.5 API converts retrieved journal excerpts into speech, allowing users to listen to their own memories instead of only reading them.

Endpoint: https://api.vachana.ai/api/v1/tts/inference

3. Secure API Integration

The Gnani API key is stored in the server environment and is never exposed in the browser.

Why Gnani AI?

Voice makes journaling more natural and accessible. Gnani AI enables users to capture their thoughts through speech and listen to their own memories in multiple Indian languages.

Privacy and Data Handling

Dear Past Me follows a local-first storage approach in its current prototype.

Journal entries and future notes are stored in the browser's local storage.
Journal data is not uploaded to a cloud database or synchronized across browsers or devices.
Audio is sent to Gnani AI for transcription only when the user requests it.
Text submitted for spoken playback is also processed through Gnani AI.
API credentials remain on the server and are not exposed to the browser.
Future-note reminders work only while the application remains open. They do not run as background notifications.
The prototype currently has no authentication or cloud backup. Anyone using the same browser profile can access its saved journal.

These are known prototype limitations and potential areas for future development.

Participants and Contributions
[ee663582] — Sole human participant. Responsible for the individual project submission.
AI Assistance: GitHub Copilot assisted with coding during development. It was used as a development tool and was not a project participant.
Project Demonstrations

Mobile Demo — 60 Seconds

https://youtube.com/shorts/mrRJan_1Has?feature=share

A short walkthrough demonstrating the mobile experience and core voice-journaling features.

Desktop Preview

https://youtu.be/k3xM2XyY5jI

A separate desktop mockup showcasing the experience on a larger screen.

Live Application

https://past-me-production.up.railway.app

Social Media Post

What if you could ask your past self a question and get an answer from what you actually wrote?

Introducing Dear Past Me — a private, voice-first journal built to help people capture their thoughts today and rediscover them in the future.

With Dear Past Me, you can:

Write or speak your journal entries.
Ask questions and find relevant passages from your own memories.
Listen to retrieved journal entries using voice playback.
Journal in 10 Indian languages.
Leave scheduled notes for your future self.

One principle drives this project:

AI should help you find your memories, not make them up.

Answers are grounded in your actual journal entries, complete with dates and source references. When an answer isn't in your journal, the application says so instead of pretending to remember.

Powered by Gnani AI's Speech-to-Text v3 and Timbre Text-to-Speech v2.5, Dear Past Me brings multilingual voice interaction into a personal journaling experience.

Privacy is central to the current prototype: journal entries stay in browser storage rather than being uploaded to a cloud database.

🎥 Mobile Demo: https://youtube.com/shorts/mrRJan_1Has?feature=share

🖥️ Desktop Preview: https://youtu.be/k3xM2XyY5jI

🚀 Try the Live App: https://past-me-production.up.railway.app

Built as part of the Great Indian AI Internship Challenge.

#GnaniAI #GreatIndianAIInternshipChallenge #VoiceAI #IndianLanguages #AIInnovation #BuildWithAI

Project tagline:

"Your memories. Your words. Your answers. AI that helps you remember, without pretending to remember for you."