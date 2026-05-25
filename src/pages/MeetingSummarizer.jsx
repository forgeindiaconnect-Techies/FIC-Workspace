import React, { useState, useRef } from 'react';
import { getApiUrl } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Upload, FileAudio, FileVideo, Loader2, CheckCircle2, 
  Download, AlertCircle, ArrowLeft, Play, FileText,
  MessageSquare, ListTodo, ShieldAlert, FastForward
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MeetingSummarizer = () => {
  const { workspaceId, meetingId } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState('upload'); // upload, transcribing, summarizing, results
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError('File size exceeds 25MB limit for AI processing.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (!file) return;
    setLoading(true);
    setStage('transcribing');
    setError(null);

    try {
      // Step 1: Transcribe
      const formData = new FormData();
      formData.append('audio', file);

      const transcribeRes = await fetch(getApiUrl('/api/meet/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!transcribeRes.ok) {
        const errData = await transcribeRes.json();
        throw new Error(`${errData.error || 'Transcription failed.'} ${errData.details ? `Details: ${errData.details}` : ''}`);
      }
      const transcribeData = await transcribeRes.json();
      setTranscript(transcribeData.transcript);

      // Step 2: Summarize
      setStage('summarizing');
      const summarizeRes = await fetch(getApiUrl('/api/meet/summarize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcribeData.transcript,
          meetingTitle: "Meeting #" + meetingId 
        }),
      });

      if (!summarizeRes.ok) throw new Error('Summarization failed.');
      const summarizeData = await summarizeRes.json();
      setSummary(summarizeData);
      setStage('results');
    } catch (err) {
      setError(err.message);
      setStage('upload');
    } finally {
      setLoading(false);
    }
  };

  const sanitizeText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/[\u2018\u2019]/g, "'") // Smart quotes
      .replace(/[\u201C\u201D]/g, '"') // Double smart quotes
      .replace(/[\u2013\u2014]/g, '-') // Em/en dashes
      .replace(/\u2026/g, '...')      // Ellipsis
      .replace(/[^\x20-\x7E]/g, '');  // Remove all other non-standard characters
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(summary.meetingTitle, 20, y);
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("MEETING INTELLIGENCE REPORT", 20, y);
    y += 15;

    // Executive Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Executive Summary", 20, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(sanitizeText(summary.summary), pageWidth - 40);
    summaryLines.forEach(line => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(sanitizeText(line), 20, y);
      y += 6;
    });
    y += 4;

    // Key Points
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Points", 20, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    summary.keyPoints.forEach(point => {
      const lines = doc.splitTextToSize("- " + sanitizeText(point), pageWidth - 40);
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(sanitizeText(line), 20, y);
        y += 6;
      });
    });
    y += 4;

    // Decisions
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Decisions Made", 20, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    summary.decisions.forEach(decision => {
      const lines = doc.splitTextToSize("- " + sanitizeText(decision), pageWidth - 40);
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(sanitizeText(line), 20, y);
        y += 6;
      });
    });
    y += 4;

    // Action Items
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Action Items", 20, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    summary.actionItems.forEach(item => {
      const task = item.task || 'Unnamed Task';
      const owner = item.owner || 'TBD';
      const deadline = item.deadline || 'No Date';
      const fullText = `- ${task} (Owner: ${owner}, Deadline: ${deadline})`;
      const lines = doc.splitTextToSize(sanitizeText(fullText), pageWidth - 40);
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(sanitizeText(line), 20, y);
        y += 6;
      });
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated by Nexus PM Intelligence - ${new Date().toLocaleString()}`, 20, 285);

    doc.save(`Meeting_Summary_${meetingId}_${Date.now()}.pdf`);
  };

  return (
    <MeetingLayout>
      <div className="h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-12 pb-32">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <button 
              onClick={() => navigate(`/w/${workspaceId}/meetings`)}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-bold text-sm"
            >
              <ArrowLeft size={18} /> Back to Meetings
            </button>
            <div className="px-4 py-1.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200/50">
              AI Summarizer Beta
            </div>
          </div>

          {/* Stage: Upload */}
          {stage === 'upload' && (
            <div className="animate-fade">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-black tracking-tight mb-4 text-zinc-900 dark:text-white">Generate Meeting Insights</h1>
                <p className="text-zinc-500 font-medium max-w-xl mx-auto">Upload your meeting recording to get a structured AI summary, key decisions, and action items instantly.</p>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-[40px] p-16 text-center cursor-pointer transition-all group
                  ${file ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-500/5' : 'border-zinc-200 dark:border-white/5 hover:border-blue-400 dark:hover:border-blue-500/30'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="audio/*,video/*"
                />
                
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-zinc-400 group-hover:scale-110 group-hover:text-blue-500 transition-all mb-6">
                    {file ? <CheckCircle2 size={40} className="text-blue-500" /> : <Upload size={40} />}
                  </div>
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-lg font-black text-zinc-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to Process</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg font-black text-zinc-900 dark:text-white">Click or drag to upload recording</p>
                      <p className="text-sm text-zinc-500 font-medium italic">Supports MP3, WAV, MP4, WEBM (Max 25MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-600 animate-shake">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <div className="mt-12 flex justify-center">
                <button 
                  disabled={!file || loading}
                  onClick={startProcessing}
                  className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/30 hover:-translate-y-1 active:scale-95"
                >
                  Start AI Summarization
                </button>
              </div>
            </div>
          )}

          {/* Stage: Transcribing / Summarizing */}
          {(stage === 'transcribing' || stage === 'summarizing') && (
            <div className="h-96 flex flex-col items-center justify-center text-center animate-fade">
              <div className="relative mb-12">
                <div className="w-32 h-32 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {stage === 'transcribing' ? <MessageSquare size={32} className="text-blue-500" /> : <FastForward size={32} className="text-blue-500" />}
                </div>
              </div>
              <h2 className="text-2xl font-black mb-2 text-zinc-900 dark:text-white">
                {stage === 'transcribing' ? 'Converting Speech to Text...' : 'AI is Crafting Your Summary...'}
              </h2>
              <p className="text-zinc-500 font-medium">This usually takes about a minute depending on file size.</p>
            </div>
          )}

          {/* Stage: Results */}
          {stage === 'results' && summary && (
            <div className="animate-fade">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Analysis Complete</h2>
                <button 
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all"
                >
                  <Download size={18} /> Download PDF
                </button>
              </div>

              <div ref={resultsRef} className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-white/5 p-8 md:p-12 shadow-sm space-y-12">
                {/* PDF Content Starts Here */}
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2">Meeting Intelligence Report</div>
                  <h1 className="text-3xl font-black text-zinc-900 dark:text-white">{summary.meetingTitle}</h1>
                </div>

                <div className="space-y-4">
                  <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                    <FileText size={16} className="text-blue-500" /> Executive Summary
                  </h3>
                  <p className="text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                    {summary.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                      <CheckCircle2 size={16} className="text-emerald-500" /> Key Points
                    </h3>
                    <ul className="space-y-4">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-6">
                    <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                      <Play size={16} className="text-blue-500" /> Decisions Made
                    </h3>
                    <ul className="space-y-4">
                      {summary.decisions.map((decision, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          {decision}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                    <ListTodo size={16} className="text-amber-500" /> Action Items
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summary.actionItems.map((item, i) => (
                      <div key={i} className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5">
                        <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 mb-2">{item.task}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assignee: {item.owner || 'TBD'}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{item.deadline || 'No Date'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-6">
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                        <ShieldAlert size={16} className="text-rose-500" /> Risks or Concerns
                      </h3>
                      <ul className="space-y-3">
                        {summary.risks.map((risk, i) => (
                          <li key={i} className="text-xs font-bold text-rose-600 p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                            {risk}
                          </li>
                        ))}
                      </ul>
                   </div>
                   <div className="space-y-6">
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-zinc-400">
                        <MessageSquare size={16} className="text-zinc-500" /> Follow-ups
                      </h3>
                      <ul className="space-y-3">
                        {summary.followUps.map((item, i) => (
                          <li key={i} className="text-xs font-bold text-zinc-600 dark:text-zinc-400 p-3 bg-zinc-100 dark:bg-white/5 rounded-xl">
                            {item}
                          </li>
                        ))}
                      </ul>
                   </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </MeetingLayout>
  );
};

export default MeetingSummarizer;
