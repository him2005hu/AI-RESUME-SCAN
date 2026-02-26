import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ResumeEvaluation {
  resumeId: string;
  scores: {
    technicalSkills: number;
    practicalExperience: number;
    analyticalThinking: number;
    communicationEvidence: number;
  };
  totalScore: number;
  strengths: string[];
  gaps: string[];
  justification: string;
}

export interface ScreeningResult {
  evaluations: ResumeEvaluation[];
  topCandidates: string[];
  fairnessCheck: string;
}

export const screenResumes = async (resumes: { id: string; text: string }[]): Promise<ScreeningResult> => {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    You are an impartial resume-screening assistant for a Data Analyst position. Your task is to evaluate resumes strictly on job-related competencies and demonstrated skills.

    Explicit Fairness Constraints (Mandatory):
    You must not consider the following attributes in any form:
    - Gender or gender-coded language
    - Age or graduation year
    - Ethnicity, caste, religion, or race
    - Nationality or country of origin
    - University name, college prestige, or ranking

    If such attributes appear, you must ignore them completely and not reference them in reasoning or scoring.

    Evaluation Criteria (Only These Are Allowed):
    1. Technical Skills (40%): SQL, Python/R, Data cleaning & transformation, Statistical analysis, BI tools (Tableau, Power BI, etc.)
    2. Practical Experience (30%): Data analysis projects (professional or academic), Business problem framing, Real datasets and outcomes
    3. Analytical Thinking (20%): Problem-solving examples, Insight generation, Decision-support use cases
    4. Communication Evidence (10%): Clarity of explanations, Stakeholder reporting, Documentation or dashboards

    Scoring Rules:
    - Score each resume on a 0–100 scale.
    - Provide criterion-level sub-scores.
    - Use evidence-based justification quoting resume content.
  `;

  const prompt = `
    Evaluate the following 20 resumes for a Data Analyst role.
    
    Resumes:
    ${resumes.map(r => `--- Resume ID: ${r.id} ---\n${r.text}`).join("\n\n")}

    Return the results in the specified JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                resumeId: { type: Type.STRING },
                scores: {
                  type: Type.OBJECT,
                  properties: {
                    technicalSkills: { type: Type.NUMBER },
                    practicalExperience: { type: Type.NUMBER },
                    analyticalThinking: { type: Type.NUMBER },
                    communicationEvidence: { type: Type.NUMBER }
                  },
                  required: ["technicalSkills", "practicalExperience", "analyticalThinking", "communicationEvidence"]
                },
                totalScore: { type: Type.NUMBER },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                justification: { type: Type.STRING }
              },
              required: ["resumeId", "scores", "totalScore", "strengths", "gaps", "justification"]
            }
          },
          topCandidates: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of the top 5 candidates ranked" },
          fairnessCheck: { type: Type.STRING, description: "A statement confirming compliance with fairness constraints" }
        },
        required: ["evaluations", "topCandidates", "fairnessCheck"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
