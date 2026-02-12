
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, FatigueLevel } from "../types";

const API_KEY = process.env.API_KEY || '';

export const analyzeDriverState = async (base64Image: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: `Analyze the driver's face in this image for fatigue signs. 
          Focus on:
          1. Eye status (fully open, droopy, or closed).
          2. Blink frequency indicators.
          3. Head posture (tilted forward or sideways).
          4. Presence of yawning.
          
          Based on these, classify fatigue as LOW (alert), MODERATE (showing signs of tiredness), or HEAVY (dangerously sleepy).`
        }
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fatigueLevel: {
            type: Type.STRING,
            description: "One of LOW, MODERATE, HEAVY",
          },
          blinkRate: {
            type: Type.NUMBER,
            description: "Estimated blinks per minute (0-60)",
          },
          headAngle: {
            type: Type.NUMBER,
            description: "Degree of head tilt from vertical (0-90)",
          },
          eyeStatus: {
            type: Type.STRING,
            description: "OPEN, CLOSED, or DROOPY",
          },
          yawnDetected: {
            type: Type.BOOLEAN,
          },
          confidence: {
            type: Type.NUMBER,
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief explanation of the assessment",
          },
        },
        required: ["fatigueLevel", "blinkRate", "headAngle", "eyeStatus", "yawnDetected", "confidence", "reasoning"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}') as AnalysisResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid analysis data");
  }
};

export const generateAlertAudio = async (text: string): Promise<ArrayBuffer> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");

  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};
