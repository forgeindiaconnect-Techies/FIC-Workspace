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
      temperature: 0,
      response_format: 'verbose_json',
    }) as any;

    const text = transcription.text.trim();
    const lowerText = text.toLowerCase();
    
    const cleanText = lowerText.replace(/[^a-z0-9\s]/g, '').trim();
    
    // Check for high probability of silence/no-speech using segment data
    const segments = transcription.segments || [];
    let avgNoSpeechProb = 0;
    if (segments.length > 0) {
      avgNoSpeechProb = segments.reduce((acc: number, seg: any) => acc + (seg.no_speech_prob || 0), 0) / segments.length;
    }
    
    if (avgNoSpeechProb > 0.6) {
       console.log(`[Transcription] Ignored silent chunk (no_speech_prob: ${avgNoSpeechProb.toFixed(2)})`);
       return null;
    }
    
    // Whisper often hallucinates the prompt or generic phrases on silent chunks
    const isHallucination = cleanText.includes('meeting conversation in tamil and english transcribe accurately') ||
                            cleanText.includes('meeting conversation transcribe accurately') || 
                            cleanText.includes('transcribe accurately') ||
                            cleanText.includes('tanscribe accurately') ||
                            cleanText.includes('we go on') ||
                            cleanText.includes('were going to go on') ||
                            cleanText.includes('you see were getting some different individuals') ||
                            cleanText === 'thank you' || 
                            cleanText === 'thanks' ||
                            cleanText === 'subscribe' ||
                            cleanText === 'terima kasih';

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

  