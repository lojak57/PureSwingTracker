import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from '@sveltejs/kit';
import { OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatRequest {
  message: string;
  chat_history?: ChatMessage[];
}

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const swingId = params.swing_id;
    
    if (!swingId) {
      return json(
        { error: { code: 'MISSING_SWING_ID', message: 'Swing ID is required' } },
        { status: 400 }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { message, chat_history = [] } = body;

    if (!message?.trim()) {
      return json(
        { error: { code: 'MISSING_MESSAGE', message: 'Message is required' } },
        { status: 400 }
      );
    }

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Create per-request client with user's JWT for proper RLS
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // For general chat, skip swing lookup
    let swing = null;
    let profile = null;
    
    if (swingId !== 'general') {
      // Try to fetch swing data (may not exist yet)
      const { data: swingData } = await userClient
        .from('pure_swings')
        .select('*')
        .eq('id', swingId)
        .single();
      swing = swingData;
    }

    // Try to get user profile for context (may not exist yet)
    const { data: profileData } = await userClient
      .from('pure_profiles')
      .select('handicap, goals, name')
      .eq('id', user.id)
      .single();
    profile = profileData;

    // Prepare context for GPT
    const swingContext = swing ? {
      category: swing.category,
      flaws: swing.ai_flaws,
      summary: swing.ai_summary,
      user_handicap: profile?.handicap,
      user_goals: profile?.goals
    } : {
      user_handicap: profile?.handicap,
      user_goals: profile?.goals
    };

    // Create system prompt for Coach Oliver  
    const systemPrompt = swingId === 'general' 
      ? `You are Coach Oliver, an experienced PGA professional with 20+ years of teaching elite golfers. You're warm but authoritative, with deep knowledge of golf fundamentals, course strategy, and equipment.

You're having a general conversation about golf. Here's what you know about the user:
- Email: ${user.email}
- Handicap: ${profile?.handicap || 'Not specified'}
- Goals: ${profile?.goals || 'Not specified'}
- App Context: They're using Pure Golf, an AI-powered swing analysis platform

Your communication style:
- Professional yet approachable
- Draw from experience with touring professionals and amateurs
- Provide specific, actionable advice
- Ask follow-up questions to understand their game better
- Explain how Pure Golf's 3-angle video analysis can help when relevant

Keep responses conversational and under 150 words.`
      : swing ? `You are Coach Oliver, an experienced PGA professional with 20+ years of teaching elite golfers. 

You're discussing a ${swing.category} swing analysis. Here's what you know:
- Swing Category: ${swing.category}
- AI Analysis: ${swing.ai_flaws ? JSON.stringify(swing.ai_flaws) : 'Analysis pending'}
- Previous Summary: ${swing.ai_summary || 'No previous analysis available'}
- User Handicap: ${profile?.handicap || 'Not specified'}
- User Goals: ${profile?.goals || 'Not specified'}

Your communication style:
- Professional yet approachable, drawing from tour-level experience
- Focus on fundamentals and course management
- Provide specific, actionable advice
- Reference the AI analysis when available
- Always end with clear next steps

Keep responses conversational and under 150 words.` : `You are Coach Oliver, an experienced PGA professional with 20+ years of teaching elite golfers. You're warm but authoritative, with deep knowledge of golf fundamentals, course strategy, and equipment.

You're having a conversation about golf. Here's what you know about the user:
- Email: ${user.email}
- Handicap: ${profile?.handicap || 'Not specified'}
- Goals: ${profile?.goals || 'Not specified'}
- App Context: They're using Pure Golf, an AI-powered swing analysis platform

Your communication style:
- Professional yet approachable
- Draw from experience with touring professionals and amateurs
- Provide specific, actionable advice
- Ask follow-up questions to understand their game better
- Explain how Pure Golf's swing analysis can help when relevant

Keep responses conversational and under 150 words.`;

    // Build messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chat_history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    if (!OPENAI_API_KEY) {
      return json(
        { error: { code: 'API_KEY_MISSING', message: 'OpenAI API key not configured' } },
        { status: 500 }
      );
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 200,
        temperature: 0.7,
        stream: false
      })
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', await openAIResponse.text());
      return json(
        { error: { code: 'AI_SERVICE_ERROR', message: 'Failed to generate response' } },
        { status: 500 }
      );
    }

    const aiResult = await openAIResponse.json();
    const assistantMessage = aiResult.choices[0]?.message?.content;

    if (!assistantMessage) {
      return json(
        { error: { code: 'NO_RESPONSE', message: 'AI did not generate a response' } },
        { status: 500 }
      );
    }

    // Store chat message in database (use NULL for general chat)
    const actualSwingId = swingId === 'general' ? null : swingId;
    const { error: insertError } = await supabase
      .from('pure_chat_messages')
      .insert([
        {
          swing_id: actualSwingId,
          user_id: user.id,
          role: 'user',
          content: message,
          created_at: new Date().toISOString()
        },
        {
          swing_id: actualSwingId,
          user_id: user.id,
          role: 'assistant',
          content: assistantMessage,
          created_at: new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.error('Error storing chat messages:', insertError);
      // Continue anyway - don't fail the response
    }

    return json({
      message: assistantMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to process chat message' 
        } 
      },
      { status: 500 }
    );
  }
};

// Get chat history for a swing
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const swingId = params.swing_id;
    
    if (!swingId) {
      return json(
        { error: { code: 'MISSING_SWING_ID', message: 'Swing ID is required' } },
        { status: 400 }
      );
    }

    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // 🔧 FIX: Create per-request client with user's JWT for proper RLS
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Fetch chat history (RLS will automatically filter by user_id)
    console.log('🔍 Chat API - swing_id:', swingId, 'user_id:', user.id);
    
    const { data: messages, error: fetchError } = await userClient
      .from('pure_chat_messages')
      .select('*')
      .eq('swing_id', swingId)
      .order('created_at', { ascending: true });
    
    console.log('📊 Query result:', { messages: messages?.length || 0, error: fetchError });

    if (fetchError) {
      console.error('Error fetching chat history:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch chat history' } },
        { status: 500 }
      );
    }

    return json({
      messages: messages || []
    });

  } catch (error) {
    console.error('Error getting chat history:', error);
    return json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to get chat history' 
        } 
      },
      { status: 500 }
    );
  }
}; 