/**
 * Chain Checker — Admin Chain Wax Tracker
 *
 * Tracks combined Zwift virtual ride distance for Tim and Will on their shared
 * Tacx Neo 2T trainer. Shows progress toward 800km re-wax interval, puck
 * lifespan tracking, and wax history.
 */

import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { useUnits } from '../context/UnitContext';
import { kmToMiles } from '../utils/unitConversion';
import './ChainChecker.css';

function ChainChecker() {
  const { units } = useUnits();
  const [showWaxModal, setShowWaxModal] = useState(false);
  const [waxDateTime, setWaxDateTime] = useState('');

  const authStatusQuery = trpc.participant.getAuthStatus.useQuery();
  const statusQuery = trpc.chainWax.getStatus.useQuery(undefined, {
    enabled: authStatusQuery.data?.is_admin === true,
  });
  const historyQuery = trpc.chainWax.getHistory.useQuery(undefined, {
    enabled: authStatusQuery.data?.is_admin === true,
  });

  const utils = trpc.useUtils();

  const waxChainMutation = trpc.chainWax.waxChain.useMutation({
    onSuccess: () => {
      utils.chainWax.getStatus.invalidate();
      utils.chainWax.getHistory.invalidate();
      setShowWaxModal(false);
      setWaxDateTime('');
    },
  });

  const newPuckMutation = trpc.chainWax.newPuck.useMutation({
    onSuccess: () => {
      utils.chainWax.getStatus.invalidate();
    },
  });

  const resyncMutation = trpc.chainWax.resync.useMutation({
    onSuccess: () => {
      utils.chainWax.getStatus.invalidate();
      utils.chainWax.getHistory.invalidate();
    },
  });

  if (authStatusQuery.isLoading) {
    return <div className="chain-checker"><p>Loading...</p></div>;
  }

  if (!authStatusQuery.data?.is_admin) {
    return (
      <div className="chain-checker">
        <div className="chain-checker-denied">
          <h2>Access Denied</h2>
          <p>You do not have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  if (statusQuery.isLoading) {
    return <div className="chain-checker"><p>Loading chain wax status...</p></div>;
  }

  if (statusQuery.error) {
    return (
      <div className="chain-checker">
        <div className="chain-checker-error">Error: {statusQuery.error.message}</div>
      </div>
    );
  }

  const status = statusQuery.data!;
  const history = historyQuery.data ?? [];

  const formatDist = (meters: number): string => {
    const km = meters / 1000;
    if (units === 'imperial') {
      return `${kmToMiles(km).toFixed(0)} mi`;
    }
    return `${km.toFixed(0)} km`;
  };

  const formatThreshold = (): string => {
    if (units === 'imperial') {
      return `${kmToMiles(800).toFixed(0)} mi`;
    }
    return '800 km';
  };

  const totalDistKm = status.currentPeriod.totalDistanceMeters / 1000;
  const thresholdKm = status.currentPeriod.thresholdMeters / 1000;
  const isOver = totalDistKm > thresholdKm;
  const barPercent = isOver ? 100 : status.currentPeriod.percentage;

  const handleWaxChain = () => {
    if (!waxDateTime) return;
    const unixSeconds = Math.floor(new Date(waxDateTime).getTime() / 1000);
    if (isNaN(unixSeconds) || unixSeconds <= 0) return;
    waxChainMutation.mutate({ waxedAt: unixSeconds });
  };

  const handleNewPuck = () => {
    if (confirm('Start a new wax puck? This will reset the puck use counter.')) {
      newPuckMutation.mutate();
    }
  };

  const handleResync = () => {
    resyncMutation.mutate();
  };

  const formatDate = (unix: number): string => {
    return new Date(unix * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateFull = (unix: number): string => {
    return new Date(unix * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const daysBetween = (start: number, end: number): number => {
    return Math.round((end - start) / 86400);
  };

  return (
    <div className="chain-checker">
      {/* Header */}
      <div className="chain-checker-header">
        <h2>Chain Checker</h2>
        <button
          className="chain-checker-btn chain-checker-btn-secondary"
          onClick={handleResync}
          disabled={resyncMutation.isPending}
        >
          {resyncMutation.isPending ? (
            <span className="chain-checker-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Resync
        </button>
      </div>

      {resyncMutation.isSuccess && resyncMutation.data.resync && (
        <div className="chain-checker-resync-result">
          Resync complete: {resyncMutation.data.resync.activitiesFound} virtual rides found, {resyncMutation.data.resync.newActivitiesRecorded} new recorded
        </div>
      )}

      {/* Wax Puck Section */}
      {status.puck && (
        <div className="chain-checker-section">
          <div className="chain-checker-section-header">
            <span className="chain-checker-section-title">Wax Puck Lifespan — {status.puck.waxCount}/{status.puck.maxUses}</span>
            <button
              className="chain-checker-btn chain-checker-btn-outline"
              onClick={handleNewPuck}
              disabled={newPuckMutation.isPending}
            >
              New Puck
            </button>
          </div>
          <div className="chain-checker-puck-dots">
            {Array.from({ length: status.puck.maxUses }, (_, i) => (
              <div
                key={i}
                className={`chain-checker-puck-dot ${i < status.puck!.waxCount ? 'used' : 'unused'}`}
              >
                {i < status.puck!.waxCount ? '✓' : ''}
              </div>
            ))}
          </div>
          {status.puck.isExpired && (
            <div className="chain-checker-puck-warning">
              Puck is used up! Time for a new one.
            </div>
          )}
        </div>
      )}

      {/* Progress Bar Section */}
      <div className="chain-checker-section">
        <div className="chain-checker-progress-label">
          <span className={`chain-checker-distance ${isOver ? 'over' : ''}`}>
            {formatDist(status.currentPeriod.totalDistanceMeters)}
          </span>
          <span className="chain-checker-threshold">
            / {formatThreshold()}
          </span>
          {isOver && <span className="chain-checker-over-badge">OVERDUE</span>}
        </div>
        <div className="chain-checker-progress-track">
          <div
            className={`chain-checker-progress-fill ${status.currentPeriod.colorZone}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
        <div className="chain-checker-progress-meta">
          <span>Since {formatDate(status.currentPeriod.startedAt)}</span>
          <span>{status.activityCount} activities</span>
        </div>
      </div>

      {/* Wax Your Chain Button */}
      <button
        className="chain-checker-wax-btn"
        onClick={() => setShowWaxModal(true)}
      >
        Wax Your Chain
      </button>

      {/* Wax Modal */}
      {showWaxModal && (
        <div className="chain-checker-modal-overlay" onClick={() => setShowWaxModal(false)}>
          <div className="chain-checker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Wax Your Chain</h3>
            <p>Select the date and time you waxed the chain:</p>
            <input
              type="datetime-local"
              className="chain-checker-datetime-input"
              value={waxDateTime}
              onChange={(e) => setWaxDateTime(e.target.value)}
            />
            <div className="chain-checker-modal-actions">
              <button
                className="chain-checker-btn chain-checker-btn-secondary"
                onClick={() => setShowWaxModal(false)}
              >
                Cancel
              </button>
              <button
                className="chain-checker-btn chain-checker-btn-primary"
                onClick={handleWaxChain}
                disabled={!waxDateTime || waxChainMutation.isPending}
              >
                {waxChainMutation.isPending ? 'Saving...' : 'Confirm Wax'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="chain-checker-section chain-checker-history">
          <h3>Wax History</h3>
          <div className="chain-checker-history-table-wrapper">
            <table className="chain-checker-history-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Distance</th>
                  <th>Duration</th>
                  <th>Activities</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateFull(entry.startedAt)} — {formatDateFull(entry.endedAt)}</td>
                    <td>{formatDist(entry.totalDistanceMeters)}</td>
                    <td>{daysBetween(entry.startedAt, entry.endedAt)} days</td>
                    <td>{entry.activityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChainChecker;
