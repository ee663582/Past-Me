import { createFileRoute } from "@tanstack/react-router";

const VOICES: Record<string, string> = {
  "en-IN": "Kaveri",
  "hi-IN": "Chitra",
  "ta-IN": "Noopur",
  "te-IN": "Lehara",
  "kn-IN": "Saanvi",
  "ml-IN": "Reshma",
  "mr-IN": "Zahira",
  "bn-IN": "Kirra",
  "gu-IN": "Falak",
  "pa-IN": "Mehuli",
};

export const Route = createFileRoute("/api/gnani-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GNANI_API_KEY"];
        if (!apiKey) {
          return Response.json(
            {
              error:
                "Voice playback is not configured. Add GNANI_API_KEY to the server environment.",
            },
            { status: 503 },
          );
        }

        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > 4_096) {
          return Response.json(
            { error: "Keep spoken replies under 1,200 characters." },
            { status: 413 },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Send valid JSON with text and language." },
            { status: 400 },
          );
        }

        if (
          typeof payload !== "object" ||
          payload === null ||
          !("text" in payload) ||
          typeof payload.text !== "string" ||
          payload.text.trim().length === 0 ||
          payload.text.length > 1200 ||
          !("language" in payload) ||
          typeof payload.language !== "string" ||
          !Object.hasOwn(VOICES, payload.language)
        ) {
          return Response.json(
            {
              error:
                "Provide text (up to 1,200 characters) and a supported language.",
            },
            { status: 400 },
          );
        }

        let upstream: Response;
        try {
          upstream = await fetch(
            "https://api.vachana.ai/api/v1/tts/inference",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key-ID": apiKey,
              },
              body: JSON.stringify({
                text: payload.text,
                voice: VOICES[payload.language],
                model: "timbre-v2.5",
                language: payload.language,
                speed: 0.94,
                audio_config: {
                  sample_rate: 48000,
                  num_channels: 1,
                  sample_width: 2,
                  encoding: "linear_pcm",
                  container: "wav",
                },
              }),
            },
          );
        } catch (error) {
          console.error(
            "Gnani TTS request could not be completed",
            error instanceof Error ? error.message : "Unknown network error",
          );
          return Response.json(
            {
              error:
                "Could not reach Gnani for voice playback. Please try again.",
            },
            { status: 502 },
          );
        }
        if (!upstream.ok) {
          console.error("Gnani TTS request failed", upstream.status);
          return Response.json(
            {
              error:
                "Gnani could not create the spoken reply. Please try again.",
            },
            { status: 502 },
          );
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
          },
        });
      },
    },
  },
});
