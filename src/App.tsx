/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  ShieldCheck, 
  Users, 
  FileText, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  BarChart3,
  Search,
  Plus,
  Trash2,
  Loader2,
  Trophy,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { screenResumes, type ScreeningResult, type ResumeEvaluation } from './services/geminiService';
import * as pdfjsLib from 'pdfjs-dist';

// Use a reliable CDN for the worker to avoid local fetch issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ResumeInput {
  id: string;
  text: string;
}

export default function App() {
  const [resumes, setResumes] = useState<ResumeInput[]>([
    { id: '1', text: '' }
  ]);
  const [isScreening, setIsScreening] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState<string | null>(null);
  const [successResumeId, setSuccessResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeResumeIdForUpload, setActiveResumeIdForUpload] = useState<string | null>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeResumeIdForUpload) return;

    if (file.type !== 'application/pdf') {
      setError("Please upload a PDF file.");
      return;
    }

    setIsParsingPdf(activeResumeIdForUpload);
    setError(null);

    try {
      const text = await extractTextFromPdf(file);
      handleUpdateResume(activeResumeIdForUpload, text);
      setSuccessResumeId(activeResumeIdForUpload);
      setTimeout(() => setSuccessResumeId(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to parse PDF. Please try pasting the text manually.");
    } finally {
      setIsParsingPdf(null);
      setActiveResumeIdForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = (id: string) => {
    setActiveResumeIdForUpload(id);
    fileInputRef.current?.click();
  };

  const handleAddResume = () => {
    if (resumes.length < 20) {
      setResumes([...resumes, { id: String(resumes.length + 1), text: '' }]);
    }
  };

  const handleRemoveResume = (id: string) => {
    if (resumes.length > 1) {
      setResumes(resumes.filter(r => r.id !== id));
    }
  };

  const handleUpdateResume = (id: string, text: string) => {
    setResumes(resumes.map(r => r.id === id ? { ...r, text } : r));
  };

  const handleScreening = async () => {
    const validResumes = resumes.filter(r => r.text.trim().length > 0);
    if (validResumes.length === 0) {
      setError("Please add at least one resume text.");
      return;
    }

    setIsScreening(true);
    setError(null);
    try {
      const screeningResult = await screenResumes(validResumes);
      setResult(screeningResult);
      if (screeningResult.topCandidates.length > 0) {
        setSelectedResumeId(screeningResult.topCandidates[0]);
      }
    } catch (err) {
      console.error(err);
      setError("Screening failed. Please check your API key and try again.");
    } finally {
      setIsScreening(false);
    }
  };

  const selectedEvaluation = useMemo(() => {
    return result?.evaluations.find(e => e.resumeId === selectedResumeId);
  }, [result, selectedResumeId]);

  const topEvaluations = useMemo(() => {
    if (!result) return [];
    return result.topCandidates
      .map(id => result.evaluations.find(e => e.resumeId === id))
      .filter(Boolean) as ResumeEvaluation[];
  }, [result]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] p-2 rounded-lg">
            <ShieldCheck className="text-[#E4E3E0] w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif italic text-2xl font-bold tracking-tight">FairScreen</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">Bias-Free Resume Evaluator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {result && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 border border-emerald-500/20 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-800">Fairness Compliant</span>
            </div>
          )}
          <button 
            onClick={handleScreening}
            disabled={isScreening}
            className="bg-[#141414] text-[#E4E3E0] px-6 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isScreening ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Screening...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Start Screening
              </>
            )}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-88px)]">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-4 border-r border-[#141414] p-6 overflow-y-auto max-h-[calc(100vh-88px)] bg-white/30">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-serif italic text-xl">Resume Inputs</h2>
            <button 
              onClick={handleAddResume}
              disabled={resumes.length >= 20}
              className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] rounded-lg transition-colors border border-[#141414]"
              title="Add Resume"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {resumes.map((resume, index) => (
              <div key={resume.id} className="group relative border border-[#141414] rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#141414] bg-[#141414]/5">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-50">Resume #{index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => triggerFileUpload(resume.id)}
                      disabled={isParsingPdf === resume.id}
                      className={cn(
                        "p-1 rounded transition-colors",
                        successResumeId === resume.id 
                          ? "text-emerald-600 bg-emerald-50" 
                          : "text-[#141414] hover:bg-[#141414]/5"
                      )}
                      title="Upload PDF"
                    >
                      {isParsingPdf === resume.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : successResumeId === resume.id ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button 
                      onClick={() => handleRemoveResume(resume.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={resume.text}
                  onChange={(e) => handleUpdateResume(resume.id, e.target.value)}
                  placeholder="Paste resume text here..."
                  className="w-full h-32 p-4 text-sm resize-none focus:outline-none bg-transparent font-mono"
                />
              </div>
            ))}
          </div>
          
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-8 p-8 overflow-y-auto max-h-[calc(100vh-88px)]">
          {!result && !isScreening && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-white border border-[#141414] rounded-3xl flex items-center justify-center mb-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                <Users className="w-10 h-10" />
              </div>
              <h3 className="font-serif italic text-2xl mb-2">Ready to Screen</h3>
              <p className="text-sm opacity-60 leading-relaxed">
                Add up to 20 resumes in the left panel. Our AI will evaluate them strictly on technical skills, experience, and analytical thinking, ensuring a completely bias-free process.
              </p>
            </div>
          )}

          {isScreening && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-[#141414]/10 border-t-[#141414] rounded-full animate-spin mb-8" />
                <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-20" />
              </div>
              <h3 className="font-serif italic text-2xl mb-2">Analyzing Competencies</h3>
              <p className="text-sm opacity-60 max-w-xs">
                Extracting skills and experience while filtering out demographic data...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-8">
              {/* Top Candidates Ranking */}
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h2 className="font-serif italic text-2xl">Top Ranked Candidates</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {topEvaluations.map((evalItem, idx) => (
                    <button
                      key={evalItem.resumeId}
                      onClick={() => setSelectedResumeId(evalItem.resumeId)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-left relative overflow-hidden group",
                        selectedResumeId === evalItem.resumeId 
                          ? "bg-[#141414] text-[#E4E3E0] border-[#141414] shadow-lg scale-105 z-10" 
                          : "bg-white border-[#141414]/10 hover:border-[#141414] hover:shadow-md"
                      )}
                    >
                      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1 font-mono">Rank #{idx + 1}</div>
                      <div className="font-serif italic text-lg mb-2">ID: {evalItem.resumeId}</div>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold leading-none">{evalItem.totalScore}</span>
                        <span className="text-[10px] opacity-50 mb-1">/100</span>
                      </div>
                      {selectedResumeId === evalItem.resumeId && (
                        <motion.div 
                          layoutId="active-pill"
                          className="absolute bottom-0 left-0 w-full h-1 bg-amber-500"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Detailed Evaluation */}
              <AnimatePresence mode="wait">
                {selectedEvaluation && (
                  <motion.div
                    key={selectedEvaluation.resumeId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white border border-[#141414] rounded-3xl overflow-hidden shadow-[12px_12px_0px_0px_rgba(20,20,20,0.05)]"
                  >
                    <div className="p-8 border-b border-[#141414] bg-[#141414]/5 flex justify-between items-start">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1 font-mono">Detailed Evaluation</div>
                        <h3 className="font-serif italic text-3xl">Candidate {selectedEvaluation.resumeId}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1 font-mono">Overall Score</div>
                        <div className="text-4xl font-bold">{selectedEvaluation.totalScore}</div>
                      </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Scores Breakdown */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
                          <BarChart3 className="w-3 h-3" />
                          Criterion Breakdown
                        </h4>
                        <div className="space-y-4">
                          <ScoreBar label="Technical Skills" score={selectedEvaluation.scores.technicalSkills} weight="40%" />
                          <ScoreBar label="Practical Experience" score={selectedEvaluation.scores.practicalExperience} weight="30%" />
                          <ScoreBar label="Analytical Thinking" score={selectedEvaluation.scores.analyticalThinking} weight="20%" />
                          <ScoreBar label="Communication" score={selectedEvaluation.scores.communicationEvidence} weight="10%" />
                        </div>
                      </div>

                      {/* Strengths & Gaps */}
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Key Strengths
                          </h4>
                          <ul className="space-y-2">
                            {selectedEvaluation.strengths.map((s, i) => (
                              <li key={i} className="text-sm flex gap-3">
                                <span className="text-[#141414]/30 font-mono">0{i+1}</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Identified Gaps
                          </h4>
                          <ul className="space-y-2">
                            {selectedEvaluation.gaps.map((g, i) => (
                              <li key={i} className="text-sm flex gap-3">
                                <span className="text-[#141414]/30 font-mono">0{i+1}</span>
                                {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-[#141414] text-[#E4E3E0]">
                      <h4 className="text-[10px] uppercase tracking-widest opacity-50 mb-4 font-mono">Evidence-Based Justification</h4>
                      <p className="text-sm leading-relaxed font-light opacity-90">
                        {selectedEvaluation.justification}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fairness Compliance Check */}
              <section className="bg-white border border-[#141414] rounded-2xl p-6 flex items-start gap-4">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-serif italic text-lg mb-1">Fairness Compliance Check</h4>
                  <p className="text-sm opacity-70 leading-relaxed italic">
                    "{result.fairnessCheck}"
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf"
        onChange={handleFileUpload}
      />
    </div>
  );
}

function ScoreBar({ label, score, weight }: { label: string, score: number, weight: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-mono">
        <span>{label} <span className="opacity-30">({weight})</span></span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="h-1.5 bg-[#141414]/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-[#141414]"
        />
      </div>
    </div>
  );
}
