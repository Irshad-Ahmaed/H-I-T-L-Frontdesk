import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  metrics,
  voice,
  llm,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import axios from 'axios';
import { connectDB } from './db.js';
import KnowledgeBase from './models/knowledgeBase.model.js';
import * as google from '@livekit/agents-plugin-google';
import * as cartesia from '@livekit/agents-plugin-cartesia';

dotenv.config();

// --- Connecting to the Database ---
connectDB();

class Assistant extends voice.Agent {
  private customerPhone: string;
  private backendUrl: string;

  constructor(customerPhone: string, backendUrl: string) {
    super({
      instructions: `You are a AI assistant. The user's phone number is ${customerPhone}.
      
      Your personality:
      - Professional yet warm and approachable
      - Speak clearly and at a moderate pace for phone calls
      - Keep responses concise but complete (under 30 seconds)
      
      When the user asks a question, you MUST use the 'findAnswerInKnowledgeBase' tool first.
      
      - If the tool returns a real answer, give that answer to the user in a conversational way.
      - If the tool returns the string 'NOT_FOUND', you MUST tell the user: "I'm not sure about that. I'm checking with my human supervisor and will text you the answer as soon as I have it."
      - After saying that, you MUST then call the 'escalateToHuman' tool to create the help request.
      
      Your responses must be concise and conversational.`,

      tools: {
        findAnswerInKnowledgeBase: llm.tool({
          description: 'Checks the internal knowledge base for an answer to the user\'s question.',
          parameters: z.object({
            question: z.string().describe('The user\'s question, summarized or exact.'),
          }),
          execute: async ({ question }) => {
            console.log(`[Tool] Searching KB for: "${question}"`);
            
            let entry = null;
            try {
              entry = await KnowledgeBase.findOne({ 
                question_text: { $regex: new RegExp(`^${question.trim()}$`, 'i') } 
              });
              
              if (!entry) {
                console.log(`[Tool] Exact match failed, trying broader search...`);
                entry = await KnowledgeBase.findOne({ 
                  question_text: { $regex: new RegExp(question.trim(), 'i') } 
                });
              }
            } catch (dbError) {
              console.error("[Tool] Error querying KnowledgeBase:", dbError);
              return 'DATABASE_ERROR';
            }

            if (entry) {
              console.log(`[Tool] Answer found in KB: "${entry.answer_text}"`);
              return entry.answer_text;
            }

            console.log(`[Tool] Answer NOT found in KB.`);
            return 'NOT_FOUND';
          },
        }),
        
        escalateToHuman: llm.tool({
          description: 'Escalates the user\'s question to a human supervisor by creating a help request.',
          parameters: z.object({
            question: z.string().describe('The user\'s full, original question.'),
          }),
          execute: async ({ question }) => {
            console.log(`[Tool] Escalating to human: "${question}"`);
            try {
              const url = `${this.backendUrl}/api/internal/requests`;
              await axios.post(url, {
                customerPhone: this.customerPhone, 
                question: question,
              });
              
              console.log('[Tool] Help request created successfully.');
              return 'Help request has been created successfully.';
            } catch (error) {
              console.error('[Tool] Error creating help request:', error);
              return 'Failed to create help request.';
            }
          },
        }),
      },
    });

    this.customerPhone = customerPhone;
    this.backendUrl = backendUrl;
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('[Agent] Prewarming VAD...');
    proc.userData.vad = await silero.VAD.load();
  },
  
  entry: async (ctx: JobContext) => {
    console.log('[Agent] Entry point called');
    
    // Connecting to the room FIRST ---- (This step took my 2 days of debugging) ----
    await ctx.connect();
    console.log('[Agent] Connected to room');
    
    // Wait for the participant (caller) to join
    const participant = await ctx.waitForParticipant();
    console.log(`[Agent] Participant joined: ${participant.identity}`);
    
    // Extract phone number from room name OR participant identity
    // Room name should be the caller's phone number (from dispatch rule)
    let customerPhone = ctx.room.name;
    
    // Fallback to participant identity if room name is not a phone number
    if (!customerPhone || !customerPhone.startsWith('+')) {
      customerPhone = participant.identity;
      console.log(`[Agent] Using participant identity as phone: ${customerPhone}`);
    } else {
      console.log(`[Agent] Using room name as phone: ${customerPhone}`);
    }
    
    const backendUrl = process.env.BACKEND_SERVICES_URL;
    
    // Validate environment
    if (!backendUrl) {
      console.error('[Agent] ERROR: BACKEND_SERVICES_URL is not set in .env');
      return;
    }
    
    if (!process.env.GOOGLE_API_KEY) {
      console.error('[Agent] ERROR: GOOGLE_API_KEY is not set');
      return;
    }
    
    if (!process.env.CARTESIA_API_KEY) {
      console.error('[Agent] ERROR: CARTESIA_API_KEY is not set');
      return;
    }
    
    console.log(`[Agent] Starting session for customer: ${customerPhone}`);
    console.log(`[Agent] Backend URL: ${backendUrl}`);

    // Configure the voice processing pipeline
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad! as silero.VAD,
      
      // Speech-to-Text
      stt: 'assemblyai/universal-streaming:en',
      
      // Large Language Model
      llm: new google.LLM({
        model: "gemini-2.0-flash-exp",
        apiKey: process.env.GOOGLE_API_KEY!,
        temperature: 0.7,
      }),
      
      // Text-to-Speech
      tts: new cartesia.TTS({
        model: "sonic-2",
        voice: "a0e99841-438c-4a64-b679-ae501e7d6091", // Professional voice
        apiKey: process.env.CARTESIA_API_KEY!,
        speed: 1.0,
      }),
      
      // Turn detection for natural conversation flow
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });
    
    // Metrics collection
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`[Agent] Usage Summary: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Starting the agent session
    console.log('[Agent] Starting agent session...');
    await session.start({
      agent: new Assistant(customerPhone, backendUrl),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
      outputOptions: {
        audioEnabled: true,
      }
    });
    
    console.log('[Agent] Session started successfully');
    
    // Generating personalized greeting based on time of day
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 18) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 18) {
      timeGreeting = "Good evening";
    }
    
    // Sending initial greeting
    await session.generateReply({ instructions:
      `Say '${timeGreeting}! Thank you for calling. How can I help you today?' 
      Speak warmly and professionally at a moderate pace.`
  });
  },
});

// Running the agent
cli.runApp(
  new WorkerOptions({ 
    agent: fileURLToPath(import.meta.url),
    agentName: 'CA_wYuTu9kSP574'
  })
);