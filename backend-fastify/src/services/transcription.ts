import fs from 'fs';
import Groq from 'groq-sdk';
import { Transcript } from '../models/Transcript';

let groq: Groq | null = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}
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
  if (!process.env.GROQ_API_KEY || !groq) {
    console.warn('[Transcription] GROQ_API_KEY is not set or groq client is not initialized. Skipping transcription.');
    return null;
  }

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      prompt: 'Meeting conversation in Tamil and English. Transcribe accurately.',
      response_format: 'json',
    });

    const text = transcription.text.trim();
    const lowerText = text.toLowerCase();
    
    const cleanText = lowerText.replace(/[^a-z0-9\s]/g, '').trim();
    
    // Whisper often hallucinates the prompt or generic phrases on silent chunks
    const isHallucination = cleanText.includes('meeting conversation in tamil and english transcribe accurately') ||
                            cleanText.includes('meeting conversation transcribe accurately') || 
                            cleanText.includes('transcribe accurately') ||
                            cleanText === 'thank you' || 
                            cleanText === 'thanks' ||
                            cleanText === 'subscribe';

    if (text && !isHallucination && cleanText.length > 0) {
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
