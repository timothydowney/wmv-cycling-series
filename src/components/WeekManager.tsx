import { useState, useEffect } from 'react';
import './WeekManager.css';
import { fetchWeekResults } from '../api';
import { Week } from '../types';
import { formatUnixDate, formatUnixTime } from '../utils/dateUtils';
import SegmentInput from './SegmentInput';
import SegmentMetadataDisplay from './SegmentMetadataDisplay';
import { NotesEditor } from './NotesEditor';
import { FetchProgressPanel, FetchLogEntry } from './FetchProgressPanel';
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { trpc } from '../utils/trpc';

interface WeekFormData {
  week_name: string;
  segment_id: number;
  segment_name: string;
  required_laps: number;
  multiplier: number;
  notes: string;
  // Display format: datetime-local inputs use YYYY-MM-DDTHH:MM format
  // We convert to/from Unix timestamps for API
  start_time: string;
  end_time: string;
}

interface WeekManagerProps {
  onFetchResults?: () => void;
  seasonId?: number;  // Filter weeks by season
}

function WeekManager({ onFetchResults, seasonId }: WeekManagerProps) {
  // tRPC hooks
  const { data: weeksData = [], isLoading: _isLoadingWeeks, refetch: refetchWeeks } = trpc.week.getAll.useQuery(
    { seasonId: seasonId! },
    { 
      enabled: !!seasonId,
      refetchOnWindowFocus: false
    }
  );

  // Cast the tRPC result to our frontend Week type if needed, or ensure types match
  // Sorting: Weeks come from backend sorted by start_at desc?
  // Frontend wants sorted by start_at asc (Week 1 at top)
  const weeks = [...(weeksData as unknown as Week[])].sort((a, b) => a.start_at - b.start_at);

  const createMutation = trpc.week.create.useMutation({
    onSuccess: () => {
      refetchWeeks();
    }
  });
  const updateMutation = trpc.week.update.useMutation({
    onSuccess: () => {
      refetchWeeks();
    }
  });
  const deleteMutation = trpc.week.delete.useMutation({
    onSuccess: () => {
      refetchWeeks();
    }
  });

  const [isCreating, setIsCreating] = useState(false);
  const [editingWeekId, setEditingWeekId] = useState<number | null>(null);
  const [formData, setFormData] = useState<WeekFormData>({
    week_name: '',
    segment_id: 0,
    segment_name: '',
    required_laps: 1,
    multiplier: 1,
    notes: '',
    start_time: '',
    end_time: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [fetchLogs, setFetchLogs] = useState<FetchLogEntry[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [showFetchPanel, setShowFetchPanel] = useState(false);
  const [currentFetchWeekId, setCurrentFetchWeekId] = useState<number | undefined>();
  const [currentFetchWeekName, setCurrentFetchWeekName] = useState<string | undefined>();

  // Debug: log season changes
  useEffect(() => {
    console.log(`[WeekManager] seasonId prop changed to: ${seasonId}`);
    // Reset form when season changes
    if (seasonId) {
        setEditingWeekId(null);
        setIsCreating(false);
        setFormData({
            week_name: '',
            segment_id: 0,
            segment_name: '',
            required_laps: 1,
            multiplier: 1,
            notes: '',
            start_time: '',
            end_time: ''
        });
    }
  }, [seasonId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'segment_id' || name === 'required_laps' || name === 'multiplier'
        ? parseInt(value) || 0
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!seasonId) {
        setMessage({ type: 'error', text: 'No season selected' });
        return;
    }

    // Validate all required fields
    const errors: string[] = [];
    
    if (!formData.segment_id || !formData.segment_name) {
      errors.push('Segment');
    }
    if (!formData.start_time) {
      errors.push('Start Date/Time');
    }
    if (!formData.end_time) {
      errors.push('End Date/Time');
    }
    
    if (errors.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `Missing required fields: ${errors.join(', ')}` 
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }
    
    // Convert datetime-local strings to Unix timestamps for API submission
    const datetimeLocalToUnix = (datetimeLocalStr: string): number => {
      const date = new Date(datetimeLocalStr);
      return Math.floor(date.getTime() / 1000);
    };
    
    // Use segment_name as default if week_name is not provided
    const week_name = formData.week_name?.trim() || formData.segment_name;
    
    try {
      if (editingWeekId) {
        await updateMutation.mutateAsync({
            id: editingWeekId,
            data: {
                week_name,
                segment_id: formData.segment_id,
                segment_name: formData.segment_name,
                required_laps: formData.required_laps,
                multiplier: formData.multiplier,
                start_at: datetimeLocalToUnix(formData.start_time),
                end_at: datetimeLocalToUnix(formData.end_time),
                notes: formData.notes,
                season_id: seasonId
            }
        });
      } else {
        await createMutation.mutateAsync({
            week_name,
            segment_id: formData.segment_id,
            segment_name: formData.segment_name,
            required_laps: formData.required_laps,
            multiplier: formData.multiplier,
            start_at: datetimeLocalToUnix(formData.start_time),
            end_at: datetimeLocalToUnix(formData.end_time),
            notes: formData.notes,
            season_id: seasonId
        });
      }
      
      setMessage({ 
        type: 'success', 
        text: editingWeekId ? 'Week updated successfully!' : 'Week created successfully!' 
      });
      
      // Reset form
      setIsCreating(false);
      setEditingWeekId(null);
      setFormData({
        week_name: '',
        segment_id: 0,
        segment_name: '',
        required_laps: 1,
        start_time: '',
        end_time: '',
        notes: '',
        multiplier: 1
      });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleEdit = (week: Week) => {
    // Convert Unix timestamps to datetime-local format for form editing
    const unixToDatetimeLocal = (unix: number): string => {
      const date = new Date(unix * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setFormData({
      week_name: week.week_name,
      segment_id: week.strava_segment_id ?? week.segment_id,
      segment_name: week.segment_name || '',
      required_laps: week.required_laps,
      multiplier: week.multiplier || 1,
      notes: week.notes || '',
      start_time: unixToDatetimeLocal(week.start_at),
      end_time: unixToDatetimeLocal(week.end_at)
    });
    setEditingWeekId(week.id);
    setIsCreating(true);
    
    // Scroll to the form after state updates
    setTimeout(() => {
      const formElement = document.querySelector('.week-creation-area');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  };

  const handleDelete = async (weekId: number) => {
    if (!confirm('Are you sure you want to delete this week? This will also delete all associated results.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(weekId);
      setMessage({ type: 'success', text: 'Week deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleFetchResults = async (weekId: number) => {
    const week = weeks.find(w => w.id === weekId);
    setCurrentFetchWeekId(weekId);
    setCurrentFetchWeekName(week?.week_name);
    setFetchLogs([]);
    setShowFetchPanel(true);
    setIsFetching(true);

    try {
      const result = await fetchWeekResults(weekId, (log: FetchLogEntry) => {
        console.log('[WeekManager] Received log from API:', log);
        setFetchLogs(prevLogs => [...prevLogs, log]);
      });

      // Build personalized summary with names
      const matchedParticipants = result.summary
        .filter((r: any) => r.activity_found)
        .map((r: any) => r.participant_name);
      
      const summaryMessage = matchedParticipants.length > 0
        ? `✓ Found ${matchedParticipants.length} ${matchedParticipants.length === 1 ? 'person' : 'people'}: ${matchedParticipants.join(', ')}`
        : '✓ Complete: No matching activities found';

      setFetchLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        level: 'section',
        message: '=== Summary ==='
      }, {
        timestamp: Date.now(),
        level: 'success',
        message: summaryMessage
      }]);
      
      setIsFetching(false);
      
      // Trigger leaderboard refresh in parent component
      if (onFetchResults) {
        onFetchResults();
      }
    } catch (err: any) {
      console.error('[WeekManager] Error during fetch:', err);
      setFetchLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        level: 'error',
        message: `✗ Error: ${err.message}`
      }]);
      setIsFetching(false);
    }
  };

  const handleDismissFetchPanel = () => {
    setShowFetchPanel(false);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingWeekId(null);
    setFormData({
      week_name: '',
      segment_id: 0,
      segment_name: '',
      required_laps: 1,
      multiplier: 1,
      start_time: '',
      end_time: '',
      notes: ''
    });
  };

  return (
    <div className="week-manager">
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <FetchProgressPanel
        isOpen={showFetchPanel}
        logs={fetchLogs}
        isLoading={isFetching}
        onDismiss={handleDismissFetchPanel}
        weekId={currentFetchWeekId}
        weekName={currentFetchWeekName}
      />

      <div className="weeks-list">
        <h3>Competition Schedule</h3>
        {weeks.length === 0 ? (
          <p className="no-weeks">No weeks created yet. Create your first week below.</p>
        ) : (
          <table className="weeks-table">
            <thead>
              <tr>
                <th>Week #</th>
                <th>Name</th>
                <th>Segment</th>
                <th>Laps</th>
                <th>Multiplier</th>
                <th>Start</th>
                <th>End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => (
                <tr key={week.id}>
                  <td>{index + 1}</td>
                  <td>{week.week_name}</td>
                  <td>
                    <div className="segment-cell">
                      <div className="segment-name">{week.segment_name || 'Unknown Segment'}</div>
                      <SegmentMetadataDisplay
                        segment={{
                          distance: week.segment_distance || undefined,
                          total_elevation_gain: week.segment_total_elevation_gain || undefined,
                          segment_average_grade: week.segment_average_grade || undefined
                        }}
                      />
                    </div>
                  </td>
                  <td>{week.required_laps}</td>
                  <td>{typeof week.multiplier === 'number' && week.multiplier >= 1 ? `${week.multiplier}x` : '-'}</td>
                  <td>{formatUnixDate(week.start_at)} {formatUnixTime(week.start_at)}</td>
                  <td>{formatUnixDate(week.end_at)} {formatUnixTime(week.end_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="icon-button edit-btn"
                        onClick={() => handleEdit(week)}
                        title="Edit week"
                      >
                        <PencilIcon width={28} height={28} />
                      </button>
                      <button 
                        className="icon-button delete-btn"
                        onClick={() => handleDelete(week.id)}
                        title="Delete week"
                      >
                        <TrashIcon width={28} height={28} />
                      </button>
                      <button 
                        className="icon-button fetch-btn"
                        onClick={() => handleFetchResults(week.id)}
                        title="Refresh data from Strava"
                      >
                        <ArrowPathIcon width={28} height={28} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isCreating && (
        <button 
          className="create-button"
          onClick={() => setIsCreating(true)}
        >
          + Create New Week
        </button>
      )}

      {isCreating && (
        <div className="week-creation-area">
          <form className="week-form" onSubmit={handleSubmit}>
            <h3>{editingWeekId ? 'Edit Week' : 'Create New Week'}</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="week_name">Week Name</label>
              <input
                type="text"
                id="week_name"
                name="week_name"
                value={formData.week_name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Week 1: Box Hill KOM Challenge"
              />
            </div>
          </div>

          <SegmentInput
            value={{ id: formData.segment_id, name: formData.segment_name }}
            onChange={(segmentId, segmentName) => {
              setFormData(prev => {
                // Auto-fill week_name with segment_name if week_name is empty
                const newWeekName = !prev.week_name && segmentName ? segmentName : prev.week_name;
                return {
                  ...prev,
                  segment_id: segmentId,
                  segment_name: segmentName,
                  week_name: newWeekName
                };
              });
            }}
          />

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="required_laps">Required Laps</label>
              <input
                type="number"
                id="required_laps"
                name="required_laps"
                value={formData.required_laps}
                onChange={handleInputChange}
                required
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="multiplier">Points Multiplier</label>
              <input
                type="number"
                id="multiplier"
                name="multiplier"
                value={formData.multiplier}
                onChange={handleInputChange}
                min="1"
                max="5"
                step="1"
              />
              <small>Points multiplier for this week (1-5, default 1)</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="event_date">Event Date</label>
              <input
                type="date"
                id="event_date"
                onChange={(e) => {
                  if (!e.target.value) return;
                  
                  const formatDateTimeLocal = (date: Date): string => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                  };
                  
                  // Parse selected date
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  const startDate = new Date(year, month - 1, day, 0, 0, 0); // Midnight
                  const endDate = new Date(year, month - 1, day, 22, 0, 0); // 10pm
                  
                  setFormData(prev => ({
                    ...prev,
                    start_time: formatDateTimeLocal(startDate),
                    end_time: formatDateTimeLocal(endDate)
                  }));
                }}
              />
              <small>Pick a date to auto-set start/end times below</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_time">Start Time</label>
              <input
                type="datetime-local"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleInputChange}
                required
              />
              <small>Defaults to midnight (editable)</small>
            </div>

            <div className="form-group">
              <label htmlFor="end_time">End Time</label>
              <input
                type="datetime-local"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                required
              />
              <small>Defaults to 10pm (editable)</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label htmlFor="notes">Notes & Details</label>
              <NotesEditor
                value={formData.notes}
                onChange={(notes) => setFormData(prev => ({ ...prev, notes }))}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-button">
              {editingWeekId ? 'Update Week' : 'Create Week'}
            </button>
            <button type="button" className="cancel-button" onClick={cancelEdit}>
              Cancel
            </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default WeekManager;
