import Groq from 'groq-sdk';
import { Transcript } from '../models/Transcript';
import { Meeting } from '../models/Meeting';
import { Participant } from '../models/Participant';
import { Mail } from '../models/Mail';
import { User } from '../models/User';

let groq: Groq | null = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}
async function dispatchSummaryMail(meeting: any, summaryHtml: string) {
  try {
    // Get all users who participated in this meeting via the Participant collection
    const participantDocs = await Participant.find({ meetingId: meeting._id }).distinct('userId');

    // Also include the host
    const allUserIds = [...new Set([...participantDocs.map((id: any) => id.toString()), meeting.hostId?.toString()])].filter(Boolean);

    const users = await User.find({
      _id: { $in: allUserIds },
      email: { $ne: 'ai-assistant@nexus.app' } // exclude the bot itself
    });

    if (users.length === 0) {
      console.warn('[Summarizer] No human participants found  skipping mail dispatch.');
      return;
    }

    const recipientEmails = users.map((u: any) => u.email);

    const mailDoc = {
      workspaceId: 'forge-india-connect',
      senderName: 'Forge India Connect AI',
      senderEmail: 'ai-assistant@nexus.app',
      recipientEmails,
      subject: ` Meeting Summary: ${meeting.title}`,
      body: summaryHtml,
      isRead: false,
      isStarred: false,
      sentAt: new Date()
    };

    // Create Sent copy for AI Bot
    await Mail.create({ ...mailDoc, ownerEmail: 'ai-assistant@nexus.app', folder: 'sent' });

    // Create Inbox copy for each participant
    for (const email of recipientEmails) {
      await Mail.create({ ...mailDoc, ownerEmail: email, folder: 'inbox' });
    }

    console.log(`[Summarizer]  Summary mail dispatched to ${recipientEmails.length} participant(s): ${recipientEmails.join(', ')}`);
  } catch (err: any) {
    console.error('[Summarizer] Mail dispatch failed:', err.message);
  }
}

export async function summarizeMeeting(meetingId: string) {
  console.log(`[Summarizer] Starting summarization for meeting ${meetingId}`);

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    console.warn('[Summarizer] Meeting not found:', meetingId);
    return null;
  }

  // Don't re-summarize if already done
  if (meeting.aiSummary) {
    console.log('[Summarizer] Summary already exists, skipping.');
    return meeting.aiSummary;
  }

  // Deduplication guard: prevent sending summary email more than once
  if (meeting.summarySent) {
    console.log('[Summarizer] Summary email already sent for this meeting, skipping.');
    return meeting.aiSummary || null;
  }

  // Atomically set summarySent to prevent race conditions (multiple leave events)
  const lockResult = await Meeting.findOneAndUpdate(
    { _id: meetingId, summarySent: { $ne: true } },
    { $set: { summarySent: true } },
    { new: true }
  );
  if (!lockResult) {
    console.log('[Summarizer] Another process already claimed this summary, skipping.');
    return null;
  }

  const transcripts = await Transcript.find({ meetingId }).sort({ timestamp: 1 });
  const hasTranscripts = transcripts && transcripts.length > 0;

  let summaryHtml: string;

  if (!hasTranscripts || !process.env.GROQ_API_KEY || !groq) {
    // No transcripts or no API key / groq client  send a "meeting completed" notification instead
    console.log(`[Summarizer] No transcripts found (or no API key/client). Sending completion notification.`);
    let duration = 0;
    if (meeting.scheduledAt) {
      duration = Math.max(1, Math.round((Date.now() - new Date(meeting.scheduledAt).getTime()) / 60000));
    }

    summaryHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px;border-radius:8px;margin-bottom:20px">
    <h1 style="color:#fff;margin:0;font-size:22px"> Meeting Completed</h1>
    <p style="color:#bfdbfe;margin:8px 0 0">${meeting.title}</p>
  </div>
  <div style="background:#fff;padding:20px;border-radius:8px;border:1px solid #e2e8f0">
    <h2 style="color:#1e293b;margin-top:0">Meeting Details</h2>
    <ul style="color:#475569;line-height:1.8">
      <li><strong>Title:</strong> ${meeting.title}</li>
      <li><strong>Duration:</strong> ~${duration} minutes</li>
      <li><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</li>
      <li><strong>Status:</strong> Completed</li>
    </ul>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin-top:16px;border-radius:4px">
      <p style="margin:0;color:#92400e;font-size:14px">
        <strong>Note:</strong> No audio transcript was captured for this meeting. 
        To receive full AI-generated summaries, ensure your microphone is active and AI Assistant is enabled when the meeting starts.
      </p>
    </div>
  </div>
  <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">Sent by Forge India Connect AI</p>
</div>`;
  } else {
    // We have transcripts  generate AI summary
    const fullText = transcripts.map((t: any) => `[${t.timestamp.toISOString()}] ${t.speakerName}: ${t.text}`).join('\n');
    console.log(`[Summarizer] Summarizing ${transcripts.length} transcript entries (${fullText.length} chars)...`);

    const prompt = `You are an expert Executive Assistant. Summarize the following meeting transcript.
The transcript may contain a mix of English and Tamil.
Your summary MUST be entirely in English.
Your response MUST be formatted in clean HTML suitable for an email body.
Do NOT use markdown. Use bold tags, lists, and headers (h2, h3).
Do NOT use a predefined rigid template. Dynamically analyze the meeting context and generate appropriate sections (e.g. Executive Summary, Main Discussion Points, Key Takeaways, Action Items, Ideas, etc.) based ONLY on what was actually discussed.
Focus on capturing the real essence of the conversation accurately.

Here is the meeting transcript:
${fullText}`;

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 2000,
      });

      const rawSummary = chatCompletion.choices[0]?.message?.content || '';
      let duration = meeting.durationMinutes || 60;
      if (transcripts && transcripts.length > 0) {
        const firstTs = new Date(transcripts[0].timestamp).getTime();
        const lastTs = new Date(transcripts[transcripts.length - 1].timestamp).getTime();
        duration = Math.max(1, Math.round((lastTs - firstTs) / 60000));
      } else if (meeting.scheduledAt) {
        duration = Math.max(1, Math.round((Date.now() - new Date(meeting.scheduledAt).getTime()) / 60000));
      }

      // Extract unique speakers from transcript to show participant count
      const uniqueSpeakers = new Set(transcripts.map((t: any) => t.speakerName)).size;

      // Wrap the raw AI summary in our premium Forge India email design
      summaryHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px;border-radius:8px;margin-bottom:20px">
    <h1 style="color:#fff;margin:0;font-size:22px">Meeting Summary</h1>
    <p style="color:#bfdbfe;margin:8px 0 0">${meeting.title}</p>
  </div>
  
  <div style="background:#fff;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px">
    <h2 style="color:#1e293b;margin-top:0;font-size:16px;margin-bottom:12px">Meeting Details</h2>
    <ul style="color:#475569;line-height:1.8;margin:0;padding-left:20px">
      <li><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</li>
      <li><strong>Duration:</strong> ~${duration} minutes</li>
      <li><strong>Speakers:</strong> ${uniqueSpeakers}</li>
    </ul>
  </div>

  <div style="background:#fff;padding:24px;border-radius:8px;border:1px solid #e2e8f0;color:#1e293b;line-height:1.6">
    ${rawSummary
      .replace(/<h2>/g, '<h2 style="color:#1e40af;font-size:18px;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">')
      .replace(/<h3>/g, '<h3 style="color:#334155;font-size:16px;margin-top:20px;margin-bottom:8px">')
      .replace(/<ul>/g, '<ul style="color:#475569;padding-left:20px;margin-bottom:16px">')
      .replace(/<li>/g, '<li style="margin-bottom:8px">')
    }
  </div>
  
  <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">Sent by Forge India Connect AI</p>
</div>`;
      
      console.log(`[Summarizer] AI summary generated and formatted.`);
    } catch (err: any) {
      console.error('[Summarizer] Groq API failed:', err.message);
      return null;
    }
  }

  if (summaryHtml) {
    // Save summary to meeting record
    await Meeting.findByIdAndUpdate(meetingId, { aiSummary: summaryHtml });

    // Send mail to all participants
    await dispatchSummaryMail(meeting, summaryHtml);
  }

  return summaryHtml;
}
