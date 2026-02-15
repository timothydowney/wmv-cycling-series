/**
 * ChatPanel.tsx
 *
 * Main AI Chat panel. Admin-only.
 * Sends messages via tRPC mutation, maintains conversation history,
 * renders messages with markdown via ChatMessage component.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '../utils/trpc';
import ChatMessage, { type ChatMessageData } from './ChatMessage';
import './ChatPanel.css';

/** Maximum conversation messages (user+model) before auto-trimming */
const MAX_CONVERSATION_MESSAGES = 50;

const EXAMPLE_QUESTIONS = [
  'Who is leading the current season standings?',
  'Show me last week\'s leaderboard results and compare the top 3.',
  'Compare Melissa and Michael\'s performance this season',
  'Which segments have been used this season?',
  'Who has the best watts/kg this season?',
];

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check chat status
  const statusQuery = trpc.chat.getStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Rate limit status
  const rateLimitQuery = trpc.chat.getRateLimitStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 60000, // Refresh rate limit info every minute
  });

  // Chat mutation
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'model' as const,
        content: data.message,
      }]);
      setIsThinking(false);
      // Refetch rate limit after sending
      rateLimitQuery.refetch();
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        role: 'model' as const,
        content: `Error: ${error.message}`,
      }]);
      setIsThinking(false);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback((text?: string) => {
    const messageText = (text || inputValue).trim();
    if (!messageText || isThinking) return;

    // Add user message
    const userMessage: ChatMessageData = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];

    // Trim history if too long
    const trimmedMessages = newMessages.length > MAX_CONVERSATION_MESSAGES
      ? newMessages.slice(-MAX_CONVERSATION_MESSAGES)
      : newMessages;

    setMessages(trimmedMessages);
    setInputValue('');
    setIsThinking(true);

    // Send to backend with history (excluding the latest user message, which is sent as `message`)
    const history = trimmedMessages.slice(0, -1);
    sendMessageMutation.mutate({
      message: messageText,
      history: history.map(m => ({ role: m.role, content: m.content })),
    });
  }, [inputValue, isThinking, messages, sendMessageMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  // Handle loading/error states
  if (statusQuery.isLoading) {
    return <div className="chat-panel"><div className="chat-loading">Loading chat...</div></div>;
  }

  if (statusQuery.data && !statusQuery.data.enabled) {
    return (
      <div className="chat-panel">
        <div className="chat-disabled">
          <h3>AI Chat is Disabled</h3>
          <p>The AI chat feature is currently disabled by the system administrator.</p>
        </div>
      </div>
    );
  }

  if (statusQuery.data && !statusQuery.data.configured) {
    return (
      <div className="chat-panel">
        <div className="chat-disabled">
          <h3>AI Chat Not Configured</h3>
          <p>The Gemini API key has not been set. Contact the administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="chat-header-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>AI Assistant</span>
          <span className="chat-badge">Beta</span>
        </div>
        <div className="chat-header-right">
          {rateLimitQuery.data && (
            <span className="chat-rate-info" title="Messages remaining today">
              {rateLimitQuery.data.perDayLimit - rateLimitQuery.data.dayCount} remaining today
            </span>
          )}
          {messages.length > 0 && (
            <button className="chat-clear-btn" onClick={handleClearChat} title="Clear conversation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3>Western Mass Velo AI Assistant</h3>
            <p>Ask me anything about the competition — leaderboards, standings, athlete stats, segment records, and more.</p>
            <div className="chat-examples">
              <p className="chat-examples-label">Try asking:</p>
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="chat-example-btn"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="chat-message chat-message-ai">
            <div className="chat-message-content">
              <div className="chat-thinking">
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask about leaderboards, standings, athletes..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isThinking}
          maxLength={2000}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage()}
          disabled={!inputValue.trim() || isThinking}
          title="Send message"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
