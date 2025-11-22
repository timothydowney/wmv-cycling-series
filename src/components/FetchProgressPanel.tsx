import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import './FetchProgressPanel.css';

export interface FetchLogEntry {
  timestamp: number;
  level: 'info' | 'success' | 'error' | 'section';
  message: string;
  participant?: string;
  participantId?: number;
}

interface FetchProgressPanelProps {
  isOpen: boolean;
  logs: FetchLogEntry[];
  isLoading: boolean;
  onDismiss: () => void;
  weekId?: number;
  weekName?: string;
}

export function FetchProgressPanel({
  isOpen,
  logs,
  isLoading,
  onDismiss,
  weekId,
  weekName
}: FetchProgressPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const modalTitle = weekId && weekName 
    ? `Fetching results for Week ${weekId} — ${weekName}`
    : 'Sync Progress';

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && (isLoading || logs.length > 0)) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    }
  }, [logs, isLoading]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onDismiss();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isLoading, onDismiss]);

  // Show modal only if it's open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fetch-progress-modal-overlay" onClick={(e) => {
      // Close on background click, but only if not loading
      if (e.target === modalRef.current?.parentElement && !isLoading) {
        onDismiss();
      }
    }}>
      <div className="fetch-progress-modal" ref={modalRef}>
        <div className="modal-header">
          <h2>{modalTitle}</h2>
          <button
            className="dismiss-button"
            onClick={onDismiss}
            disabled={isLoading}
            title={isLoading ? 'Syncing in progress...' : 'Close'}
            aria-label="Close progress modal"
          >
            <XMarkIcon width={20} height={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="logs-container">
            {logs.length === 0 && !isLoading && (
              <p className="empty-state">Starting sync...</p>
            )}

            {logs.map((log, index) => (
              <div
                key={index}
                className={`log-entry log-${log.level}`}
                data-participant={log.participant}
              >
                <span className="log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}

            {isLoading && logs.length > 0 && (
              <div className="log-entry log-info loading-indicator">
                <span className="spinner"></span>
                <span className="log-message">Syncing...</span>
              </div>
            )}

            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
