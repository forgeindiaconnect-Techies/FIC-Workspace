import fs from 'fs';
import Groq from 'groq-sdk';
import { Transcript } from '../models/Transcript';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Transcribe an audio chunk using Groq Whisper.
 * @param meetingId ID of the meeting
 * @param userId ID of the speaker
 * @param speakerName Name of the speaker
 * @param filePath Path to the temporary audio file (.webm or .mp4)
 */
export async function transcribeChunk(
  meetingId: string,
  userId: string,
  speakerName: string,
  filePath: string
): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) {
    console.warn('[Transcription] GROQ_API_KEY is not set. Skipping transcription.');
    return null;
  }

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      prompt: 'Meeting conversation. Transcribe accurately.',
      response_format: 'json',
      language: 'en',
    });

    const text = transcription.text.trim();
    if (text) {
      await Transcript.create({
        meetingId,
        userId,
        speakerName,
        text,
        timestamp: new Date()
      });
      return text;
    }
    return null;
  } catch (error: any) {
    console.error('[Transcription] Failed to transcribe chunk:', error.message);
    return null;
  }
}
