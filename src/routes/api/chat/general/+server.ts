import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatRequest {
  message: string;
  chat_history?: ChatMessage[];
}

export const POST: RequestHandler = async ({ request }) => {
  try {
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
    console.log('AUTH', { token: token?.slice(0,8), authError });
    
    if (authError || !user) {
      return json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from('users')
      .select('handicap, goals')
      .eq('id', user.id)
      .single();

    // Create system prompt for Coach Oliver general conversations
    const systemPrompt = `You are Coach Oliver, an experienced PGA professional with 20+ years of teaching elite golfers. You're warm but authoritative, with deep knowledge of golf fundamentals, course strategy, and equipment.

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
        model: 'gpt-4o-2024-05-13',
        messages,
        max_tokens: 200,
        temperature: 0.7,
        stream: false
      })
    });

    if (!openAIResponse.ok) {
      const txt = await openAIResponse.text();
      console.error('OPENAI ERR', openAIResponse.status, txt);
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

    // Store general chat messages with swing_id as 'general'
    const { error: insertError } = await supabase
      .from('pure.chat_messages')
      .insert([
        {
          swing_id: 'general',
          user_id: user.id,
          role: 'user',
          content: message,
          created_at: new Date().toISOString()
        },
        {
          swing_id: 'general',
          user_id: user.id,
          role: 'assistant',
          content: assistantMessage,
          created_at: new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.error('INSERT ERR', insertError);
      // Continue anyway - don't fail the response
    }

    return json({
      message: assistantMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in general chat endpoint:', error);
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

// Get general chat history
export const GET: RequestHandler = async ({ request }) => {
  try {
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

    // Fetch general chat history
    const { data: messages, error: fetchError } = await supabase
      .from('pure.chat_messages')
      .select('*')
      .eq('swing_id', 'general')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching general chat history:', fetchError);
      return json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch chat history' } },
        { status: 500 }
      );
    }

    return json({
      messages: messages || []
    });

  } catch (error) {
    console.error('Error getting general chat history:', error);
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