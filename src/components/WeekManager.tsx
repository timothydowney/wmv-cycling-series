import { useState, useEffect } from 'react';
import './WeekManager.css';
import { getWeeks, Week, createWeek, updateWeek, deleteWeek, fetchWeekResults } from '../api';
import { formatUnixDate, formatUnixTime } from '../utils/dateUtils';
import SegmentInput from './SegmentInput';
import { NotesEditor } from './NotesEditor';
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface WeekFormData {
  week_name: string;
  segment_id: number;
  segment_name: string;
  required_laps: number;
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
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingWeekId, setEditingWeekId] = useState<number | null>(null);
  const [formData, setFormData] = useState<WeekFormData>({
    week_name: '',
    segment_id: 0,
    segment_name: '',
    required_laps: 1,
    notes: '',
    start_time: '',
    end_time: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Debug: log season changes
  useEffect(() => {
    console.log(`[WeekManager] seasonId prop changed to: ${seasonId}`);
  }, [seasonId]);

  useEffect(() => {
    const loadWeeks = async () => {
      if (!seasonId) {
        console.log(`[WeekManager] Skipping load - seasonId is ${seasonId}`);
        return;
      }
      console.log(`[WeekManager] Loading weeks for seasonId=${seasonId}`);
      try {
        const data = await getWeeks(seasonId);
        console.log(`[WeekManager] API returned ${data.length} weeks:`, data);
        // Sort weeks by start_at ascending (oldest first, so Week 1 appears at top)
        const sortedWeeks = [...data].sort((a, b) => a.start_at - b.start_at);
        setWeeks(sortedWeeks);
        console.log(`[WeekManager] Loaded ${sortedWeeks.length} weeks for season ${seasonId}`, sortedWeeks);
      } catch (err) {
        console.error('[WeekManager] Failed to fetch weeks:', err);
      }
      
      // Clear form when season changes
      setEditingWeekId(null);
      setIsCreating(false);
      setFormData({
        week_name: '',
        segment_id: 0,
        segment_name: '',
        required_laps: 1,
        notes: '',
        start_time: '',
        end_time: ''
      });
    };

    loadWeeks();
  }, [seasonId]);

  // Refetch weeks (called after create/update/delete)
  const refetchWeeks = async () => {
    if (!seasonId) return;
    try {
      const data = await getWeeks(seasonId);
      const sortedWeeks = [...data].sort((a, b) => a.start_at - b.start_at);
      setWeeks(sortedWeeks);
      console.log(`[WeekManager] Refetched ${sortedWeeks.length} weeks for season ${seasonId}`);
    } catch (err) {
      console.error('[WeekManager] Failed to refetch weeks:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'segment_id' || name === 'required_laps' 
        ? parseInt(value) || 0
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    const submitData = {
      week_name,
      segment_id: formData.segment_id,
      segment_name: formData.segment_name,
      required_laps: formData.required_laps,
      start_at: datetimeLocalToUnix(formData.start_time),
      end_at: datetimeLocalToUnix(formData.end_time),
      notes: formData.notes
    };
    
    console.log('Submitting week form data:', submitData);
    
    try {
      const result = editingWeekId 
        ? await updateWeek(editingWeekId, submitData)
        : await createWeek(submitData);

      console.log('Week saved successfully:', result);
      
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
        notes: ''
      });
      
      // Refresh weeks list
      await refetchWeeks();
      
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
      await deleteWeek(weekId);
      setMessage({ type: 'success', text: 'Week deleted successfully!' });
      await refetchWeeks();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleFetchResults = async (weekId: number) => {
    setMessage({ type: 'success', text: 'Fetching results... this may take a moment.' });

    try {
      const result = await fetchWeekResults(weekId);
      setMessage({ 
        type: 'success', 
        text: `Fetched results for ${result.participants_processed} participants. Found ${result.results_found} qualifying activities.` 
      });
      
      // Trigger leaderboard refresh in parent component
      if (onFetchResults) {
        onFetchResults();
      }
      
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingWeekId(null);
    setFormData({
      week_name: '',
      segment_id: 0,
      segment_name: '',
      required_laps: 1,
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
                  <td>{week.segment_name || 'Unknown Segment'}</td>
                  <td>{week.required_laps}</td>
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
