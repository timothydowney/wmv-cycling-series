import { useEffect, useMemo, useState } from 'react';
import './ManageSegments.css';
import { getAuthStatus } from '../api';
import { ValidatedSegmentDetails } from '../types';
import { trpc } from '../utils/trpc';
import SegmentCard from './SegmentCard';

const parseSegmentInput = (input: string): string | null => {
  const trimmed = input.trim();
  // numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed;
  // URL formats like https://www.strava.com/segments/12744502?x=y
  const urlMatch = trimmed.match(/segments\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  return null;
};

function ManageSegments() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const utils = trpc.useUtils();
  const { data: segments = [], isLoading: loading, error: loadErrorObject, refetch } = trpc.segment.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const loadError = loadErrorObject?.message || null;

  const createMutation = trpc.segment.create.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const [input, setInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<ValidatedSegmentDetails | null>(null);
  const [lastValidatedId, setLastValidatedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check admin status on mount
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const status = await getAuthStatus();
        setIsAdmin(status.is_admin || false);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdmin();
  }, []);

  const existingIds = useMemo(() => new Set(segments.map(s => s.strava_segment_id)), [segments]);

  const handleValidate = async () => {
    setActionMessage(null);
    setValidated(null);

    const id = parseSegmentInput(input);
    if (!id) {
      setActionMessage({ type: 'error', text: 'Please enter a valid Strava segment URL or numeric ID.' });
      return;
    }

    setValidating(true);
    try {
      // Manually trigger query
      const details = await utils.client.segment.validate.query(id);
      if (!details) throw new Error('Segment not found or invalid');
      // The router returns ValidatedSegmentDetails compatible object
      setValidated(details as ValidatedSegmentDetails);
      setLastValidatedId(id);
      if (existingIds.has(details.strava_segment_id)) {
        setActionMessage({ type: 'success', text: 'Segment already exists in database.' });
      } else {
        setActionMessage({ type: 'success', text: 'Segment validated. Click "Add to Database" to save.' });
      }
    } catch (e: any) {
      const msg = e?.message || 'Validation failed';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setValidating(false);
    }
  };

  const autoValidate = async () => {
    // Avoid redundant validates for same parsed ID
    const id = parseSegmentInput(input);
    if (!id) {
      setValidated(null);
      setLastValidatedId(null);
      setActionMessage(input.trim() ? { type: 'error', text: 'Invalid segment URL or ID' } : null);
      return;
    }
    if (lastValidatedId === id && validated) {
      return; // already valid
    }
    await handleValidate();
  };

  const handleAdd = async () => {
    if (!validated) return;
    try {
      await createMutation.mutateAsync({
        strava_segment_id: validated.strava_segment_id,
        name: validated.name,
        distance: validated.distance || undefined,
        average_grade: validated.average_grade || undefined,
        city: validated.city || undefined,
        state: validated.state || undefined,
        country: validated.country || undefined
      });
      
      setActionMessage({ type: 'success', text: 'Segment saved to database.' });
      setValidated(null);
      setInput('');
      setLastValidatedId(null);
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Failed to save segment' });
    }
  };

  const handleRefreshAll = async () => {
    if (segments.length === 0) return;

    setRefreshing(true);
    setActionMessage(null);
    
    let successCount = 0;
    let errorCount = 0;

    for (const segment of segments) {
      try {
        const details = await utils.client.segment.validate.query(segment.strava_segment_id);
        if (!details) {
            console.error(`Failed to refresh segment ${segment.strava_segment_id}: Not found`);
            errorCount++;
            continue;
        }
        await createMutation.mutateAsync({
            strava_segment_id: details.strava_segment_id,
            name: details.name,
            distance: details.distance || undefined,
            average_grade: details.average_grade || undefined,
            city: details.city || undefined,
            state: details.state || undefined,
            country: details.country || undefined
        });
        successCount++;
      } catch (e) {
        console.error(`Failed to refresh segment ${segment.strava_segment_id}:`, e);
        errorCount++;
      }
    }

    setRefreshing(false);
    
    if (errorCount === 0) {
      setActionMessage({ type: 'success', text: `Successfully refreshed metadata for ${successCount} segments.` });
    } else {
      setActionMessage({ type: 'error', text: `Refreshed ${successCount} segments, ${errorCount} failed.` });
    }

    setTimeout(() => setActionMessage(null), 5000);
  };

  if (checkingAuth) {
    return <div className="manage-segments"><p>Loading...</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="manage-segments">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Access Denied</h2>
          <p>You do not have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-segments">
      <div className="segment-add-form">
        <h3>Add a Segment</h3>
        {actionMessage && (
          <div className={`message-box ${actionMessage.type}`}>{actionMessage.text}</div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="segment-input">Strava Segment URL or ID</label>
            <input
              id="segment-input"
              type="text"
              placeholder="https://www.strava.com/segments/12744502 or 12744502"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onBlur={() => { void autoValidate(); }}
              onPaste={() => { setTimeout(() => { void autoValidate(); }, 0); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void autoValidate(); } }}
            />
            <div className={`inline-status ${validated ? 'success' : ''} ${actionMessage?.type === 'error' ? 'error' : ''}`}>
              {validating ? 'Validating with Strava…' : validated ? 'Validated' : 'Paste a URL or ID; validation runs automatically'}
            </div>
          </div>
        </div>

        {validated && (
          <div className="validated-preview">
            <SegmentCard
              id={validated.strava_segment_id}
              name={validated.name}
              distance={validated.distance || undefined}
              average_grade={validated.average_grade || undefined}
              city={validated.city || undefined}
              state={validated.state || undefined}
              country={validated.country || undefined}
            />
          </div>
        )}

        <div className="actions-row">
          <button
            className="secondary-btn"
            disabled={validating || !validated || existingIds.has(String(validated?.strava_segment_id))}
            onClick={handleAdd}
          >
            Add to Database
          </button>
        </div>
      </div>

      <h3 className="section-title">
        Known Segments
        {segments.length > 0 && (
          <button 
            className="refresh-all-button" 
            onClick={handleRefreshAll}
            disabled={refreshing}
            title="Fetch latest metadata from Strava for all segments"
          >
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Metadata'}
          </button>
        )}
      </h3>
      {loading ? (
        <div>Loading…</div>
      ) : loadError ? (
        <div className="empty-hint">{loadError}</div>
      ) : segments.length === 0 ? (
        <div className="empty-hint">No segments yet. Validate and add one above.</div>
      ) : (
        <div className="segments-grid">
          {segments.map(s => (
            <SegmentCard
              key={s.strava_segment_id}
              id={s.strava_segment_id}
              name={s.name}
              distance={s.distance || undefined}
              average_grade={s.average_grade || undefined}
              city={s.city || undefined}
              state={s.state || undefined}
              country={s.country || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageSegments;
