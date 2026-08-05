/**
 * Production Vercel Serverless Function Proxy for Gemini Multimodal Live API
 * Path: /api/gemini.js
 * 
 * Securely requests short-lived Ephemeral Tokens from Gemini API (v1alpha).
 * Permanent GEMINI_API_KEY never enters client-side JavaScript.
 */

import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY environment variable is missing in serverless environment.',
      code: 'AUTH_FAILED'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let ephemeralTokenStr = '';
    try {
      const tokenRes = await ai.authTokens.create({
        config: {
          expireTime,
          httpOptions: { apiVersion: 'v1alpha' }
        }
      });
      ephemeralTokenStr = tokenRes.name || tokenRes.token || (typeof tokenRes === 'string' ? tokenRes : '');
    } catch (tokenErr) {
      console.warn('ai.authTokens.create failed, trying REST endpoint fallback:', tokenErr.message);
      
      const restRes = await fetch(`https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expireTime })
      });

      if (restRes.ok) {
        const data = await restRes.json();
        ephemeralTokenStr = data.name || data.token || '';
      } else {
        throw tokenErr;
      }
    }

    if (!ephemeralTokenStr) {
      throw new Error('Failed to generate valid ephemeral session token.');
    }

    return res.status(200).json({
      status: 'authenticated',
      token: ephemeralTokenStr,
      isEphemeral: true,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Serverless auth proxy error:', error);
    return res.status(500).json({
      error: 'Failed to negotiate live session ephemeral token.',
      code: 'AUTH_FAILED',
      details: error.message
    });
  }
}
