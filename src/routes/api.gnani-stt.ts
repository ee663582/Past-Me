import { createFileRoute } from "@tanstack/react-router";

const LANGUAGES = new Set([
  "en-IN",
  "hi-IN",
  "ta-IN",
  "te-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "bn-IN",
  "gu-IN",
  "pa-IN",
]);

export const Route = createFileRoute("/api/gnani-stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GNANI_API_KEY"];
        if (!apiKey) {
          return Response.json(
            {
              error:
                "Voice transcription is not configured. Add GNANI_API_KEY to the server environment.",
            },
            { status: 503 },
          );
        }

        const contentLength = Number(request.headers.get("content-length"));
        if (
          Number.isFinite(contentLength) &&
          contentLength > 16 * 1024 * 1024
        ) {
          return Response.json(
            { error: "Choose an audio recording smaller than 15 MB." },
            { status: 413 },
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return Response.json(
            { error: "Send a valid audio recording and language." },
            { status: 400 },
          );
        }
        const audio = formData.get("audio");
        const language = formData.get("language");
        if (
          !(audio instanceof File) ||
          audio.size === 0 ||
          audio.size > 15 * 1024 * 1024 ||
          audio.type !== "audio/wav"
        ) {
          return Response.json(
            { error: "Send a WAV recording smaller than 15 MB." },
            { status: 400 },
          );
        }
        if (typeof language !== "string" || !LANGUAGES.has(language)) {
          return Response.json(
            { error: "Choose a supported language." },
            { status: 400 },
          );
        }

        const gnaniForm = new FormData();
        gnaniForm.append("audio_file", audio, "journal-entry.wav");
        gnaniForm.append("language_code", language);

        let upstream: Response;
        try {
          upstream = await fetch("https://api.vachana.ai/stt/v3", {
            method: "POST",
            headers: { "X-API-Key-ID": apiKey },
            body: gnaniForm,
          });
        } catch (error) {
          console.error(
            "Gnani STT request could not be completed",
            error instanceof Error ? error.message : "Unknown network error",
          );
          return Response.json(
            {
              error:
                "Could not reach Gnani for transcription. Please try again.",
            },
            { status: 502 },
          );
        }
        if (!upstream.ok) {
          console.error("Gnani STT request failed", upstream.status);
          return Response.json(
            {
              error:
                "Gnani could not transcribe that recording. Please try again or type your entry.",
            },
            { status: 502 },
          );
        }

        let payload: unknown;
        try {
          payload = await upstream.json();
        } catch {
          console.error("Gnani STT returned invalid JSON");
          return Response.json(
            {
              error:
                "The transcription service returned an unexpected response.",
            },
            { status: 502 },
          );
        }
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("transcript" in payload) ||
          typeof payload.transcript !== "string"
        ) {
          console.error("Gnani STT returned an unexpected response");
          return Response.json(
            {
              error:
                "The transcription service returned an unexpected response.",
            },
            { status: 502 },
          );
        }

        return Response.json({ transcript: payload.transcript });
      },
    },
  },
});
