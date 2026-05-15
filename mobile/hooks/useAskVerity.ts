import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AskSource {
  type: string;
  id: string;
  rank: number;
  metadata: Record<string, unknown>;
}

export interface AskResponse {
  answer: string;
  sources: AskSource[];
  chunks_searched: number;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AskSource[];
  timestamp: Date;
}

export function useAskVerity() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string) => {
    if (!question.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ask-verity', {
        body: { question: question.trim() },
      });

      if (fnError) throw new Error(fnError.message);

      const response = data as AskResponse;

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get answer';
      setError(errMsg);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't answer that right now. ${errMsg}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, ask, clearChat };
}
