import Groq from 'groq-sdk';
import { Transcript } from '../models/Transcript';
import { Meeting } from '../models/Meeting';
import { Mail } from '../models/Mail';
import { User } from '../models/User';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function summarizeMeeting(meetingId: string) {
  if (!process.env.GROQ_API_KEY) {
    console.warn('[Summarizer] GROQ_API_KEY not set.');
    return null;
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return null;

  const transcripts = await Transcript.find({ meetingId }).sort({ timestamp: 1 });
  if (!transcripts || transcripts.length === 0) {
    console.log('[Summarizer] No transcripts found for meeting:', meetingId);
    return null;
  }

  let fullText = transcripts.map(t => `[${t.timestamp.toISOString()}] ${t.speakerName}: ${t.text}`).join('\n');

  const prompt = `
You are an expert Executive Assistant. Summarize the following meeting transcript.
Your response MUST be formatted in clean HTML suitable for an email body.
Do NOT use markdown. Use bold tags, lists, and headers (h2, h3).
Include the following sections exactly:
<h2>Executive Summary</h2>
(Brief 2-3 sentences overview)

<h2>Main Topics</h2>
<ul><li>Topic 1</li></ul>

<h2>Key Decisions</h2>
<ul><li>Decision 1</li></ul>

<h2>Action Items</h2>
<ul><li>[Owner Name] Task description (Deadline if any)</li></ul>

<h2>Pending Topics & Follow-ups</h2>
<ul><li>Follow-up 1</li></ul>

Here is the meeting transcript:
${fullText}
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 2000,
    });

    const summaryHtml = chatCompletion.choices[0]?.message?.content || '';
    
    if (summaryHtml) {
      await Meeting.findByIdAndUpdate(meetingId, { aiSummary: summaryHtml });

      // Deliver Internal Mail
      const aiBotUser = await User.findOne({ email: 'ai-assistant@nexus.app' });
      if (aiBotUser && meeting.participantIds && meeting.participantIds.length > 0) {
        const participants = await User.find({ _id: { $in: meeting.participantIds } });
        const recipientEmails = participants.map(p => p.email);

        const mailDoc = {
          workspaceId: 'antigraviity-hq',
          senderName: 'Nexus AI Assistant',
          senderEmail: 'ai-assistant@nexus.app',
          recipientEmails,
          subject: `Meeting Summary: ${meeting.title}`,
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
        console.log(`[Summarizer] Dispatched summary mail to ${recipientEmails.length} participants.`);
      }
    }
    
    return summaryHtml;
  } catch (err: any) {
    console.error('[Summarizer] Failed to summarize meeting:', err.message);
    return null;
  }
}
