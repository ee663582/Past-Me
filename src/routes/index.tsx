import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Heart,
  Headphones,
  LockKeyhole,
  Mic,
  MicOff,
  MoreHorizontal,
  Pause,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "../styles/journal.css";

const STORAGE_KEY = "dear-past-me-v1";
const LANGUAGE_OPTIONS = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ta-IN", label: "Tamil" },
  { value: "te-IN", label: "Telugu" },
  { value: "kn-IN", label: "Kannada" },
  { value: "ml-IN", label: "Malayalam" },
  { value: "mr-IN", label: "Marathi" },
  { value: "bn-IN", label: "Bengali" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "pa-IN", label: "Punjabi" },
] as const;

type Language = (typeof LANGUAGE_OPTIONS)[number]["value"];
type JournalEntry = {
  id: string;
  text: string;
  createdAt: string;
  isDemo?: boolean;
};
type FutureNote = {
  id: string;
  text: string;
  createdAt: string;
  remindAt: string;
  openedAt?: string;
};
type SavedData = { entries: JournalEntry[]; futureNotes: FutureNote[] };
type RecordingPurpose = "entry" | "question";

const DEMO_ENTRIES: JournalEntry[] = [
  {
    id: "demo-presentation",
    createdAt: "2026-11-07T18:20:00.000Z",
    isDemo: true,
    text: "I'm nervous about my first campus placement interview tomorrow. I keep thinking I will freeze. Last time I felt this way before the biology presentation, I practised my opening with Anaya over chai. Once I started, the rest came back. I got through it.",
  },
  {
    id: "demo-small-steps",
    createdAt: "2026-11-04T13:45:00.000Z",
    isDemo: true,
    text: "Placement prep feels huge, so I'm breaking it into small pieces. I promised myself I would do one mock interview with Anaya and practise my introduction tonight. I felt proud when I finished. Small steps worked for me during NEET prep too.",
  },
  {
    id: "demo-call-home",
    createdAt: "2026-10-30T16:10:00.000Z",
    isDemo: true,
    text: "I called Amma after a rough day. I didn't need a solution, just someone to listen. A walk and a call helped me reset.",
  },
];

const STOP_WORDS = new Set(
  "a an and are as at be been before being but by can did do does feel feeling felt for from had has have i in is it its last like me my of on or our so that the this to too was we were what when where which who why with would you your".split(
    " ",
  ),
);

function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function getLocalDateTimeMinimum() {
  const date = new Date(Date.now() + 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function getRelevantMemories(question: string, entries: JournalEntry[]) {
  const keywords = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  if (keywords.length === 0) return [];

  return entries
    .map((entry) => {
      const text = entry.text.toLowerCase();
      const matched = [...new Set(keywords)].filter((word) =>
        text.includes(word),
      );
      return { entry, score: matched.length, matched };
    })
    .filter((result) => result.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.entry.createdAt.localeCompare(a.entry.createdAt),
    )
    .slice(0, 2)
    .map(({ entry, matched }) => {
      const sentences = entry.text.match(/[^.!?]+[.!?]?/g) ?? [entry.text];
      const rankedSentences = sentences
        .map((text) => ({
          text: text.trim(),
          score: matched.filter((word) => text.toLowerCase().includes(word))
            .length,
        }))
        .sort((a, b) => b.score - a.score);
      const bestSentence = rankedSentences[0]?.text;
      const bestIndex = Math.max(
        0,
        sentences.findIndex((sentence) => sentence.trim() === bestSentence),
      );
      const excerpt = sentences
        .slice(bestIndex, bestIndex + 3)
        .join(" ")
        .trim();
      return { entry, quote: excerpt || entry.text, matched };
    });
}

function encodeWav(audioBuffer: AudioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const frames = audioBuffer.length;
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(bytes);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + frames * channels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const channelData = Array.from({ length: channels }, (_, channel) =>
    audioBuffer.getChannelData(channel),
  );
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, channelData[channel]?.[frame] ?? 0),
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dear Past Me — your voice, remembered" },
      {
        name: "description",
        content:
          "A private, voice-first journal that helps you find wisdom in your own words and leave a note for your future self.",
      },
    ],
  }),
  component: DearPastMe,
});

function DearPastMe() {
  const [entries, setEntries] = useState<JournalEntry[]>(DEMO_ENTRIES);
  const [futureNotes, setFutureNotes] = useState<FutureNote[]>([]);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en-IN");
  const [activeView, setActiveView] = useState<"journal" | "future">("journal");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPurpose, setRecordingPurpose] =
    useState<RecordingPurpose | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnswerSpeaking, setIsAnswerSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState<ReturnType<
    typeof getRelevantMemories
  > | null>(null);
  const [futureDraft, setFutureDraft] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [showFutureComposer, setShowFutureComposer] = useState(false);
  const [dueNotes, setDueNotes] = useState<FutureNote[]>([]);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedNotesRef = useRef(new Set<string>());
  const recordingTimerRef = useRef<number | null>(null);
  const recorderStopRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SavedData>;
        if (
          Array.isArray(parsed.entries) &&
          Array.isArray(parsed.futureNotes)
        ) {
          setEntries(parsed.entries);
          setFutureNotes(parsed.futureNotes);
        }
      }
    } catch (error) {
      console.error("Could not load the local journal", error);
      setNotice(
        "Your saved journal could not be loaded. You can still write a new entry.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ entries, futureNotes } satisfies SavedData),
      );
    } catch (error) {
      console.error("Could not save the local journal", error);
      setNotice(
        "This device could not save your journal. Try freeing some browser storage.",
      );
    }
  }, [entries, futureNotes, loaded]);

  const checkDueNotes = useCallback(() => {
    const now = Date.now();
    const due = futureNotes.filter(
      (note) => !note.openedAt && new Date(note.remindAt).getTime() <= now,
    );
    setDueNotes(due);
    if ("Notification" in window && Notification.permission === "granted") {
      for (const note of due) {
        if (notifiedNotesRef.current.has(note.id)) continue;
        try {
          new Notification("A note from past you is ready", {
            body: note.text.slice(0, 120),
            tag: note.id,
          });
        } catch (error) {
          console.error("Could not display a journal reminder", error);
        }
        notifiedNotesRef.current.add(note.id);
      }
    }
  }, [futureNotes]);

  useEffect(() => {
    checkDueNotes();
    const interval = window.setInterval(checkDueNotes, 30_000);
    return () => window.clearInterval(interval);
  }, [checkDueNotes]);

  useEffect(
    () => () => {
      if (recordingTimerRef.current !== null)
        window.clearInterval(recordingTimerRef.current);
      if (recorderStopRef.current !== null)
        window.clearTimeout(recorderStopRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    },
    [],
  );

  const filteredEntries = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const sorted = [...entries].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return normalized
      ? sorted.filter((entry) => entry.text.toLowerCase().includes(normalized))
      : sorted;
  }, [entries, search]);

  const saveEntry = () => {
    const text = draft.trim();
    if (text.length < 8) {
      setNotice("Add a little more to your entry before saving.");
      return;
    }
    setEntries((current) => [
      { id: makeId(), text, createdAt: new Date().toISOString() },
      ...current,
    ]);
    setDraft("");
    setAnswer(null);
    setNotice("Saved on this device. Your voice has a place to land.");
  };

  const deleteFutureNote = (id: string) => {
    setFutureNotes((current) => current.filter((note) => note.id !== id));
    setDueNotes((current) => current.filter((note) => note.id !== id));
  };

  const transcribe = async (
    recording: Blob,
    purpose: RecordingPurpose = "entry",
  ) => {
    setIsTranscribing(true);
    setNotice("");
    try {
      const audioContext = new AudioContext();
      let wav: Blob;
      try {
        const decoded = await audioContext.decodeAudioData(
          await recording.arrayBuffer(),
        );
        const sampleRate = 16_000;
        const offlineContext = new OfflineAudioContext(
          1,
          Math.ceil(decoded.duration * sampleRate),
          sampleRate,
        );
        const source = offlineContext.createBufferSource();
        source.buffer = decoded;
        source.connect(offlineContext.destination);
        source.start();
        wav = encodeWav(await offlineContext.startRendering());
      } finally {
        await audioContext.close();
      }
      const formData = new FormData();
      formData.append("audio", wav, "journal-entry.wav");
      formData.append("language", selectedLanguage);
      const response = await fetch("/api/gnani-stt", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        transcript?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Transcription failed. Please try again.",
        );
      if (!payload.transcript?.trim())
        throw new Error(
          "I couldn't hear words in that recording. Try again or type instead.",
        );
      const transcript = payload.transcript.trim();
      if (purpose === "question") {
        setQuestion(transcript);
        setAnswer(getRelevantMemories(transcript, entries));
        setNotice("I searched your journal for that question.");
        return;
      }
      setDraft(
        (current) => `${current}${current.trim() ? " " : ""}${transcript}`,
      );
      setNotice("Transcript ready—give it a quick review before saving.");
    } catch (error) {
      console.error("Journal transcription failed", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Transcription failed. Please try again or type instead.",
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const stopRecording = () => {
    if (recorderStopRef.current !== null)
      window.clearTimeout(recorderStopRef.current);
    recorderStopRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    setIsRecording(false);
    setRecordingPurpose(null);
    if (recordingTimerRef.current !== null)
      window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  };

  const startRecording = async (purpose: RecordingPurpose = "entry") => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice(
        "This browser can't record audio. You can still type your journal entry.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const recording = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (recording.size > 0) void transcribe(recording, purpose);
        else setNotice("No audio was captured. Please try again.");
      };
      recorder.start();
      setRecordingSeconds(0);
      setRecordingPurpose(purpose);
      setIsRecording(true);
      setNotice(
        purpose === "entry"
          ? "Speak naturally. Your recording stops after 30 seconds."
          : "Ask your question aloud. Recording stops after 30 seconds.",
      );
      recordingTimerRef.current = window.setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000,
      );
      recorderStopRef.current = window.setTimeout(stopRecording, 30_000);
    } catch (error) {
      console.error("Microphone access failed", error);
      setNotice(
        "Microphone access was not available. Check browser permissions or type your entry.",
      );
    }
  };

  const askPastMe = () => {
    const prompt = question.trim();
    if (!prompt) {
      setNotice("Ask a question to look through your journal.");
      return;
    }
    setAnswer(getRelevantMemories(prompt, entries));
    setNotice("");
  };

  const speakText = async (text: string, answerAudio = false) => {
    if (answerAudio) setIsAnswerSpeaking(true);
    else setIsSpeaking(true);
    setNotice("");
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const response = await fetch("/api/gnani-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: Array.from(text).slice(0, 1100).join(""),
          language: selectedLanguage,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Could not create spoken audio.");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
        setIsAnswerSpeaking(false);
        setNotice("Could not play that audio. Please try again.");
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
        setIsAnswerSpeaking(false);
      };
      await audio.play();
    } catch (error) {
      console.error("Journal voice playback failed", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Spoken playback failed. Please try again.",
      );
      setIsSpeaking(false);
      setIsAnswerSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsAnswerSpeaking(false);
  };

  const saveFutureNote = () => {
    if (futureDraft.trim().length < 8 || !remindAt) {
      setNotice("Add a message and choose when you want to hear it.");
      return;
    }
    const reminder = new Date(remindAt);
    if (Number.isNaN(reminder.getTime()) || reminder.getTime() <= Date.now()) {
      setNotice("Choose a reminder time in the future.");
      return;
    }
    const note: FutureNote = {
      id: makeId(),
      text: futureDraft.trim(),
      createdAt: new Date().toISOString(),
      remindAt: reminder.toISOString(),
    };
    setFutureNotes((current) => [note, ...current]);
    setFutureDraft("");
    setRemindAt("");
    setShowFutureComposer(false);
    setNotice(
      "A note is waiting for future you. Keep this page open for its reminder.",
    );
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotice(
        "This browser does not support notifications. Your note will still appear here when it's due.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotice(
        permission === "granted"
          ? "Notifications enabled. Your reminder will appear while this app is open."
          : "Notifications are off. Keep this page open to see due reminders here.",
      );
    } catch (error) {
      console.error("Could not request notification permission", error);
      setNotice(
        "Notifications are unavailable here. Due notes will still appear while this app is open.",
      );
    }
  };

  const openFutureNote = (note: FutureNote) => {
    setFutureNotes((current) =>
      current.map((item) =>
        item.id === note.id
          ? { ...item, openedAt: new Date().toISOString() }
          : item,
      ),
    );
    setDueNotes((current) => current.filter((item) => item.id !== note.id));
  };

  const deleteEntry = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setAnswer(null);
  };

  const clearJournal = () => {
    setEntries([]);
    setFutureNotes([]);
    setDueNotes([]);
    setAnswer(null);
    setShowDeleteConfirm(false);
    setNotice("Journal and future notes cleared from this device.");
  };

  const greeting = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <main className="journal-page">
      <aside className="journal-sidebar">
        <a
          className="journal-brand"
          href="/dear-past-me"
          aria-label="Dear Past Me home"
        >
          <span className="journal-brand-icon">
            <Heart size={17} fill="currentColor" />
          </span>
          <span>
            dear past me<span className="journal-brand-period">.</span>
          </span>
        </a>
        <p className="journal-nav-label">YOUR SPACE</p>
        <button
          className={`journal-nav-item ${activeView === "journal" ? "is-active" : ""}`}
          onClick={() => setActiveView("journal")}
        >
          <AudioLines size={17} /> Journal <span>{entries.length}</span>
        </button>
        <button
          className={`journal-nav-item ${activeView === "future" ? "is-active" : ""}`}
          onClick={() => setActiveView("future")}
        >
          <Send size={16} /> Notes for later{" "}
          <span>{futureNotes.filter((note) => !note.openedAt).length}</span>
        </button>
        <div className="journal-sidebar-spacer" />
        <div className="journal-sidebar-note">
          <span className="journal-sidebar-sparkle">
            <Sparkles size={15} />
          </span>
          <p>Somewhere in your own words, there’s a reminder you need today.</p>
          <button onClick={() => setActiveView("journal")}>
            Find it <ArrowRight size={13} />
          </button>
        </div>
        <div className="journal-sidebar-footer">
          <LockKeyhole size={13} /> Private to this device
        </div>
      </aside>

      <section className="journal-main">
        <header className="journal-topbar">
          <div className="journal-mobile-brand">
            <Heart size={15} fill="currentColor" /> dear past me<span>.</span>
          </div>
          <div className="journal-topbar-right">
            <label className="journal-language">
              <span className="sr-only">Voice language</span>
              <select
                value={selectedLanguage}
                onChange={(event) =>
                  setSelectedLanguage(event.target.value as Language)
                }
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              className="journal-icon-button"
              onClick={enableNotifications}
              aria-label="Enable reminder notifications"
              title="Enable reminder notifications"
            >
              <Bell size={17} />
            </button>
            <button
              className="journal-text-button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Clear data
            </button>
          </div>
        </header>

        <nav className="journal-mobile-nav" aria-label="Primary navigation">
          <button
            className={activeView === "journal" ? "is-active" : ""}
            aria-current={activeView === "journal" ? "page" : undefined}
            onClick={() => setActiveView("journal")}
          >
            <AudioLines size={17} />
            Journal
            <span>{entries.length}</span>
          </button>
          <button
            className={activeView === "future" ? "is-active" : ""}
            aria-current={activeView === "future" ? "page" : undefined}
            onClick={() => setActiveView("future")}
          >
            <Send size={16} />
            Notes for later
            <span>
              {futureNotes.filter((note) => !note.openedAt).length}
            </span>
          </button>
        </nav>

        {dueNotes.length > 0 && (
          <div className="journal-due-banner">
            <div className="journal-due-icon">
              <Heart size={17} fill="currentColor" />
            </div>
            <div>
              <strong>A note from past you is ready.</strong>
              <p>{dueNotes[0]?.text}</p>
            </div>
            <button
              className="journal-button journal-button-small"
              onClick={() => dueNotes[0] && openFutureNote(dueNotes[0])}
            >
              Open note
            </button>
            <button
              className="journal-icon-button"
              aria-label="Dismiss reminder"
              onClick={() => dueNotes[0] && openFutureNote(dueNotes[0])}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="journal-content">
          {activeView === "journal" ? (
            <>
              <div className="journal-heading-row">
                <div>
                  <p className="journal-eyebrow">
                    {greeting.toUpperCase()} <span>·</span> A LITTLE SPACE FOR
                    YOU
                  </p>
                  <h1>
                    The voice you needed
                    <br className="journal-desktop-break" /> is already in you.
                  </h1>
                  <p className="journal-subheading">
                    Leave a note for the person you’re becoming. Come back when
                    you need to remember.
                  </p>
                </div>
                <div className="journal-heading-stamp" aria-hidden="true">
                  <span className="journal-stamp-sun">✳</span>
                  <span>
                    YOUR
                    <br />
                    OWN
                    <br />
                    WITNESS
                  </span>
                </div>
              </div>

              <section
                className="journal-compose-card"
                aria-label="Write a journal entry"
              >
                <div className="journal-compose-top">
                  <span className="journal-compose-icon">
                    <AudioLines size={17} />
                  </span>
                  <div>
                    <h2>What’s on your mind?</h2>
                    <p>No perfect words needed. Just yours.</p>
                  </div>
                  <span className="journal-today-label">
                    <span /> TODAY
                  </span>
                </div>
                <textarea
                  aria-label="Journal entry"
                  placeholder="Start wherever you are…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={4000}
                />
                <div className="journal-compose-bottom">
                  <div className="journal-compose-hint">
                    <LockKeyhole size={13} /> Only saved on this device
                  </div>
                  <div className="journal-compose-actions">
                    <span className="journal-char-count">
                      {draft.length}/4000
                    </span>
                    <button
                      className={`journal-record-button ${isRecording && recordingPurpose === "entry" ? "is-recording" : ""}`}
                      onClick={
                        isRecording && recordingPurpose === "entry"
                          ? stopRecording
                          : () => void startRecording("entry")
                      }
                      disabled={
                        isTranscribing ||
                        (isRecording && recordingPurpose === "question")
                      }
                    >
                      {isRecording && recordingPurpose === "entry" ? (
                        <>
                          <span className="journal-record-dot" />{" "}
                          {`Listening 0:${String(recordingSeconds).padStart(2, "0")}`}{" "}
                          <MicOff size={15} />
                        </>
                      ) : isTranscribing ? (
                        <>
                          <span className="journal-spinner" /> Transcribing…
                        </>
                      ) : (
                        <>
                          <Mic size={15} /> Speak
                        </>
                      )}
                    </button>
                    <button
                      className="journal-button journal-save-button"
                      onClick={saveEntry}
                      disabled={!draft.trim()}
                    >
                      Save entry <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
              <section className="journal-reflect">
                <div className="journal-section-heading">
                  <div>
                    <span className="journal-overline">
                      A NOTE FROM YOUR PAST SELF
                    </span>
                    <h2>Ask what you already know.</h2>
                  </div>
                  <span className="journal-sparkle-badge">
                    <Sparkles size={14} /> GROUNDED IN YOUR WORDS
                  </span>
                </div>
                <div className="journal-question-box">
                  <Search size={17} />
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && askPastMe()}
                    placeholder="Have I felt nervous before? What helped?"
                    aria-label="Ask a question about your journal"
                  />
                  <button
                    className={`journal-question-mic ${isRecording && recordingPurpose === "question" ? "is-recording" : ""}`}
                    onClick={
                      isRecording && recordingPurpose === "question"
                        ? stopRecording
                        : () => void startRecording("question")
                    }
                    disabled={
                      isTranscribing ||
                      (isRecording && recordingPurpose === "entry")
                    }
                    aria-label={
                      isRecording && recordingPurpose === "question"
                        ? "Stop asking by voice"
                        : "Ask by voice"
                    }
                    title="Ask by voice"
                  >
                    {isRecording && recordingPurpose === "question" ? (
                      <MicOff size={15} />
                    ) : (
                      <Mic size={15} />
                    )}
                  </button>
                  <button onClick={askPastMe} aria-label="Search your journal">
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="journal-prompt-chips">
                  {[
                    "What helped when I felt nervous?",
                    "What did I promise myself?",
                    "When did I feel proud?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setQuestion(prompt);
                        setAnswer(getRelevantMemories(prompt, entries));
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {answer !== null && (
                  <div className="journal-answer-card" aria-live="polite">
                    {answer.length > 0 ? (
                      <>
                        <div className="journal-answer-heading">
                          <span className="journal-answer-heart">
                            <Heart size={15} fill="currentColor" />
                          </span>
                          <div>
                            <strong>Here’s what you told yourself.</strong>
                            <span> A memory, not a guess.</span>
                          </div>
                          <button
                            className="journal-icon-button"
                            aria-label={
                              isAnswerSpeaking
                                ? "Stop speaking"
                                : "Read answer aloud"
                            }
                            onClick={() =>
                              isAnswerSpeaking
                                ? stopSpeaking()
                                : void speakText(
                                    answer.map(({ quote }) => quote).join(". "),
                                    true,
                                  )
                            }
                          >
                            {isAnswerSpeaking ? (
                              <Pause size={15} />
                            ) : (
                              <Volume2 size={16} />
                            )}
                          </button>
                        </div>
                        {answer.map(({ entry, quote }) => (
                          <article className="journal-memory" key={entry.id}>
                            <span className="journal-quote-mark">“</span>
                            <blockquote>{quote}</blockquote>
                            <div className="journal-memory-source">
                              <span>
                                {entry.isDemo
                                  ? "SAMPLE MEMORY"
                                  : "YOUR JOURNAL"}
                              </span>
                              <span>·</span>
                              <span>{formatDate(entry.createdAt)}</span>
                              <button
                                onClick={() =>
                                  document
                                    .getElementById(`entry-${entry.id}`)
                                    ?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "center",
                                    })
                                }
                              >
                                View entry <ArrowDown size={12} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </>
                    ) : (
                      <div className="journal-no-memory">
                        <CircleHelp size={18} />
                        <div>
                          <strong>I couldn’t find that in your journal.</strong>
                          <p>
                            I won’t make up a memory. Add an entry about it,
                            then ask me again.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="journal-entries">
                <div className="journal-section-heading">
                  <div>
                    <span className="journal-overline">YOUR TIMELINE</span>
                    <h2>Small moments, kept.</h2>
                  </div>
                  <label className="journal-entry-search">
                    <Search size={14} />
                    <input
                      placeholder="Find a moment…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      aria-label="Search journal entries"
                    />
                  </label>
                </div>
                {entries.every((entry) => entry.isDemo) && (
                  <div className="journal-demo-note">
                    <Sparkles size={14} /> Sample memories to try the
                    experience. Delete them and add your own whenever you’re
                    ready.
                  </div>
                )}
                {filteredEntries.length ? (
                  <div className="journal-entry-list">
                    {filteredEntries.map((entry) => (
                      <article
                        className="journal-entry-card"
                        key={entry.id}
                        id={`entry-${entry.id}`}
                      >
                        <div className="journal-entry-date">
                          <span>
                            {new Intl.DateTimeFormat("en-IN", {
                              day: "2-digit",
                              timeZone: "Asia/Kolkata",
                            }).format(new Date(entry.createdAt))}
                          </span>
                          <small>
                            {new Intl.DateTimeFormat("en-IN", {
                              month: "short",
                              timeZone: "Asia/Kolkata",
                            })
                              .format(new Date(entry.createdAt))
                              .toUpperCase()}
                          </small>
                        </div>
                        <div className="journal-entry-body">
                          <div className="journal-entry-meta">
                            {formatDate(entry.createdAt)} <span>·</span>{" "}
                            {formatTime(entry.createdAt)}
                            {entry.isDemo && <em>SAMPLE</em>}
                          </div>
                          <p
                            id={`entry-text-${entry.id}`}
                            className={
                              expandedEntryIds.has(entry.id) ? "is-expanded" : ""
                            }
                          >
                            {entry.text}
                          </p>
                          <button
                            className="journal-entry-expand"
                            aria-expanded={expandedEntryIds.has(entry.id)}
                            aria-controls={`entry-text-${entry.id}`}
                            onClick={() =>
                              setExpandedEntryIds((current) => {
                                const next = new Set(current);
                                if (next.has(entry.id)) next.delete(entry.id);
                                else next.add(entry.id);
                                return next;
                              })
                            }
                          >
                            {expandedEntryIds.has(entry.id)
                              ? "Show less"
                              : "Read full note"}
                          </button>
                        </div>
                        <button
                          className="journal-icon-button journal-delete-entry"
                          onClick={() => deleteEntry(entry.id)}
                          aria-label="Delete journal entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="journal-empty">
                    <Bookmark size={20} />
                    <strong>
                      {search
                        ? "No entries match that search."
                        : "Your first page is waiting."}
                    </strong>
                    <p>
                      {search
                        ? "Try another word or clear your search."
                        : "Write or speak a thought above to begin."}
                    </p>
                  </div>
                )}
              </section>
              <footer className="journal-footer">
                <LockKeyhole size={13} /> Your entries stay in this browser.
                Gnani receives a recording only when you request a
                transcription.{" "}
                <button onClick={() => setShowDeleteConfirm(true)}>
                  Delete everything
                </button>
              </footer>
            </>
          ) : (
            <section className="journal-future-view">
              <button
                className="journal-back-link"
                onClick={() => setActiveView("journal")}
              >
                <ArrowLeft size={15} /> Back to journal
              </button>
              <div className="journal-heading-row">
                <div>
                  <p className="journal-eyebrow">
                    A LITTLE LETTER THROUGH TIME
                  </p>
                  <h1>
                    Leave a light on
                    <br className="journal-desktop-break" /> for future you.
                  </h1>
                  <p className="journal-subheading">
                    Say what you hope you’ll remember. Choose a moment to come
                    back to it.
                  </p>
                </div>
                <div className="journal-heading-stamp" aria-hidden="true">
                  <span className="journal-stamp-sun">✳</span>
                  <span>
                    FROM
                    <br />
                    YOU
                    <br />
                    TO YOU
                  </span>
                </div>
              </div>
              {!showFutureComposer ? (
                <button
                  className="journal-new-note-card"
                  onClick={() => setShowFutureComposer(true)}
                >
                  <span className="journal-new-note-icon">
                    <Plus size={19} />
                  </span>
                  <span>
                    <strong>Write a note for later</strong>
                    <small>
                      Before an exam, a hard conversation, or just because.
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ) : (
                <div className="journal-compose-card journal-future-composer">
                  <div className="journal-compose-top">
                    <span className="journal-compose-icon">
                      <Heart size={16} />
                    </span>
                    <div>
                      <h2>What do you want to remember?</h2>
                      <p>Be kind to the version of you who’ll read this.</p>
                    </div>
                    <button
                      className="journal-icon-button"
                      aria-label="Close composer"
                      onClick={() => setShowFutureComposer(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    aria-label="Message to future self"
                    value={futureDraft}
                    onChange={(event) => setFutureDraft(event.target.value)}
                    placeholder="Dear future me…"
                    maxLength={2000}
                  />
                  <div className="journal-reminder-row">
                    <label htmlFor="future-reminder">
                      <CalendarDays size={15} /> Remind me on
                    </label>
                    <input
                      id="future-reminder"
                      type="datetime-local"
                      value={remindAt}
                      onChange={(event) => setRemindAt(event.target.value)}
                      min={getLocalDateTimeMinimum()}
                    />
                    <button className="journal-button" onClick={saveFutureNote}>
                      Save for later <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
              <div className="journal-future-privacy">
                <Bell size={16} />
                <p>
                  <strong>A gentle heads-up, not a promise.</strong> Reminders
                  appear while this app is open. Enable browser notifications
                  with the bell above if you’d like a notification too.
                </p>
              </div>
              <div className="journal-future-list-heading">
                <span className="journal-overline">
                  YOUR LETTERS THROUGH TIME
                </span>
                <button onClick={enableNotifications}>
                  <Bell size={14} /> Enable reminders
                </button>
              </div>
              {futureNotes.length ? (
                <div className="journal-entry-list">
                  {[...futureNotes]
                    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
                    .map((note) => (
                      <article
                        className={`journal-future-note ${note.openedAt ? "is-opened" : ""}`}
                        key={note.id}
                      >
                        <div className="journal-future-note-icon">
                          <Heart size={16} />
                        </div>
                        <div className="journal-future-note-content">
                          <div className="journal-entry-meta">
                            {note.openedAt
                              ? `OPENED ${formatDate(note.openedAt)}`
                              : `OPENS ${formatDate(note.remindAt)} · ${formatTime(note.remindAt)}`}
                          </div>
                          <p>{note.text}</p>
                        </div>
                        {!note.openedAt &&
                        new Date(note.remindAt).getTime() <= Date.now() ? (
                          <>
                            <button
                              className="journal-button journal-button-small"
                              onClick={() => openFutureNote(note)}
                            >
                              Open note
                            </button>
                            <button
                              className="journal-icon-button"
                              aria-label="Delete future note"
                              onClick={() => deleteFutureNote(note.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="journal-future-status">
                              {note.openedAt ? (
                                <Check size={14} />
                              ) : (
                                <Clock3 size={14} />
                              )}
                            </span>
                            <button
                              className="journal-icon-button"
                              aria-label="Delete future note"
                              onClick={() => deleteFutureNote(note.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                </div>
              ) : (
                <div className="journal-empty">
                  <Send size={20} />
                  <strong>No letters on the way yet.</strong>
                  <p>
                    Write one for an important day—or a completely ordinary one.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <aside className="journal-right-rail">
        <div className="journal-rail-date">
          <CalendarDays size={15} />
          <span>YOUR JOURNAL</span>
          <button className="journal-icon-button" aria-label="Journal details">
            <MoreHorizontal size={17} />
          </button>
        </div>
        <div className="journal-rail-card">
          <div className="journal-rail-art">
            <span>✳</span>
            <span>
              you are
              <br />
              still becoming
            </span>
            <span>✳</span>
          </div>
          <div className="journal-rail-card-copy">
            <span>THE POINT ISN’T TO BE OVER IT</span>
            <p>
              It’s to remember that you’ve made it through hard things before.
            </p>
          </div>
        </div>
        <div className="journal-rail-divider" />
        <div className="journal-rail-section-title">
          <span>YOUR LITTLE ARCHIVE</span>
          <button
            className="journal-icon-button"
            aria-label="Add entry"
            onClick={() => {
              setActiveView("journal");
              document
                .querySelector(".journal-compose-card textarea")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="journal-rail-stat">
          <div>
            <strong>{entries.length.toString().padStart(2, "0")}</strong>
            <span>moments kept</span>
          </div>
          <div className="journal-rail-stat-icon">
            <Bookmark size={16} />
          </div>
        </div>
        <div className="journal-rail-stat">
          <div>
            <strong>
              {futureNotes
                .filter((note) => !note.openedAt)
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>notes on the way</span>
          </div>
          <div className="journal-rail-stat-icon">
            <Send size={16} />
          </div>
        </div>
        <div className="journal-rail-quote">
          <span>“</span>
          <p>
            You don’t have to become someone new. Sometimes you just need to
            remember who you already are.
          </p>
          <small>A NOTE TO KEEP</small>
        </div>
        <button
          className="journal-listen-link"
          onClick={() => {
            const entry = entries[0];
            if (entry) void speakText(entry.text.slice(0, 500));
            else
              setNotice(
                "Write an entry first, and it can be read back to you.",
              );
          }}
        >
          {isSpeaking ? <Pause size={14} /> : <Headphones size={15} />}
          {isSpeaking ? "Stop listening" : "Hear your latest entry"}
          <ArrowRight size={13} />
        </button>
      </aside>

      {notice && (
        <div className="journal-live-notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="journal-modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setShowDeleteConfirm(false)
          }
        >
          <div
            className="journal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="journal-modal-icon">
              <Trash2 size={19} />
            </div>
            <h2 id="delete-title">Let it all go?</h2>
            <p>
              This permanently removes all journal entries and future notes
              saved in this browser. There’s no undo.
            </p>
            <div>
              <button
                className="journal-button journal-button-muted"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Keep my memories
              </button>
              <button
                className="journal-button journal-button-danger"
                onClick={clearJournal}
              >
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
