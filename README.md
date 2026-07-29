# 🎙️ Vispo AI - Gemini Multimodal Live Voice Assistant

An enterprise-grade, real-time voice and vision web application powered by **Google's Gemini Multimodal Live API** (`bidiGenerateContent`) and the official `@google/genai` SDK.

## ✨ Key Features

- **⚡ Real-Time Bidirectional Voice & Vision**: Continuous 16kHz PCM audio input streaming and live camera frame processing with instant voice responses.
- **🔊 Low-Latency `AudioWorklet` Pipeline**: Custom Web Audio API `AudioWorkletNode` engine running on a dedicated audio thread for stutter-free, off-main-thread recording and 24kHz PCM playback.
- **🔐 Secure Dual-Authentication Architecture**:
  - **Mode 1 (BYOK - Bring Your Own Key)**: Key stored strictly in client `localStorage` with zero server exposure.
  - **Mode 2 (Hosted Production Mode)**: Ephemeral token negotiation via Vercel Serverless Proxy (`/api/gemini`) protecting permanent API keys.
- **🧠 Dynamic Model Discovery & Fallback Engine**: Queries available Live-compatible models dynamically for your authenticated API key, caching the working model and recursively iterating candidate queues on fallback.
- **⚙️ Explicit Finite State Machine (FSM)**: Robust lifecycle management (`CONNECTING`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`, `RECONNECTING`, `DISCONNECTED`).
- **🛠️ Developer Diagnostics Panel**: Real-time overlay inspecting connection latency, auth negotiation time, byte upload/download throughput, and session state.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS, Lucide Icons
- **AI Core**: Official `@google/genai` SDK
- **Audio Engineering**: Web Audio API (`AudioWorkletNode`, `GainNode`, `AnalyserNode`)
- **Backend Proxy**: Vercel Serverless Functions (`/api/gemini`)

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional for Hosted Mode)
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
