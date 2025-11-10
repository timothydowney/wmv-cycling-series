import { useState, useEffect } from 'react';
import './WeekManager.css';
import { getWeeks, Week } from '../api';
import SegmentFinder from './SegmentFinder';
import SegmentSearch from './SegmentSearch';

interface WeekFormData {
  week_name: string;
  segment_id: number;
  segment_name: string;
  required_laps: number;
  start_time: string; // ISO 8601 format
  end_time: string;   // ISO 8601 format
}

function WeekManager() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingWeekId, setEditingWeekId] = useState<number | null>(null);
  const [formData, setFormData] = useState<WeekFormData>({
    week_name: '',
    segment_id: 0,
    segment_name: '',
    required_laps: 1,
    start_time: '',
    end_time: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchWeeks();
  }, []);

  const fetchWeeks = async () => {
    try {
      const data = await getWeeks();
      // Sort weeks by end_time ascending (oldest first, so Week 1 appears at top)
      const sortedWeeks = [...data].sort((a, b) => 
        new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
      );
      setWeeks(sortedWeeks);
    } catch (err) {
      console.error('Failed to fetch weeks:', err);
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
    
    // Get segment input value
    const segmentInput = (document.getElementById('segment_input') as HTMLInputElement)?.value.trim();
    
    // Extract segment ID from URL or use as-is if it's just a number
    let segmentId = formData.segment_id;
    let segmentName = formData.segment_name;
    
    if (segmentInput) {
      // Extract ID from URL like https://www.strava.com/segments/12744502
      const urlMatch = segmentInput.match(/segments\/(\d+)/);
      const extractedId = urlMatch ? urlMatch[1] : segmentInput;
      
      if (!/^\d+$/.test(extractedId)) {
        setMessage({ type: 'error', text: 'Invalid segment ID or URL' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      
      // Validate segment exists and get name
      try {
        const response = await fetch(`http://localhost:3001/admin/segments/${extractedId}/validate`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Segment not found or invalid');
        }
        
        const segmentData = await response.json();
        segmentId = parseInt(extractedId);
        segmentName = segmentData.name;
      } catch (err: any) {
        setMessage({ type: 'error', text: `Failed to validate segment: ${err.message}` });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } else if (!editingWeekId) {
      // Creating new week - segment is required
      setMessage({ type: 'error', text: 'Segment is required' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }
    
    const submitData = {
      ...formData,
      segment_id: segmentId,
      segment_name: segmentName
    };
    
    console.log('Submitting week form data:', submitData);
    
    try {
      const url = editingWeekId 
        ? `http://localhost:3001/admin/weeks/${editingWeekId}`
        : 'http://localhost:3001/admin/weeks';
      
      const method = editingWeekId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Server error response:', error);
        throw new Error(error.message || error.error || JSON.stringify(error));
      }

      const result = await response.json();
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
        end_time: ''
      });
      
      // Clear segment input
      const segmentInputEl = document.getElementById('segment_input') as HTMLInputElement;
      if (segmentInputEl) segmentInputEl.value = '';
      
      // Refresh weeks list
      await fetchWeeks();
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleEdit = (week: Week) => {
    setFormData({
      week_name: week.week_name,
      segment_id: week.strava_segment_id ? parseInt(week.strava_segment_id) : week.segment_id,
      segment_name: week.segment_name || '',
      required_laps: week.required_laps,
      start_time: week.start_time,
      end_time: week.end_time
    });
    setEditingWeekId(week.id);
    setIsCreating(true);
  };

  const handleDelete = async (weekId: number) => {
    if (!confirm('Are you sure you want to delete this week? This will also delete all associated results.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/admin/weeks/${weekId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete week');
      }

      setMessage({ type: 'success', text: 'Week deleted successfully!' });
      await fetchWeeks();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleFetchResults = async (weekId: number) => {
    if (!confirm('This will fetch activities from all connected participants. Continue?')) {
      return;
    }

    setMessage({ type: 'success', text: 'Fetching results... this may take a moment.' });

    try {
      const response = await fetch(`http://localhost:3001/admin/weeks/${weekId}/fetch-results`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch results');
      }

      const result = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Fetched results for ${result.participants_processed} participants. Found ${result.results_found} qualifying activities.` 
      });
      
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
      end_time: ''
    });
  };

  const handleSegmentSelect = (segmentId: number, segmentName: string) => {
    console.log('Segment selected:', segmentId, segmentName);
    setFormData(prev => ({
      ...prev,
      segment_id: segmentId,
      segment_name: segmentName
    }));
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
                  <td>{new Date(week.start_time).toLocaleString()}</td>
                  <td>{new Date(week.end_time).toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="edit-btn"
                        onClick={() => handleEdit(week)}
                      >
                        Edit
                      </button>
                      <button 
                        className="fetch-btn"
                        onClick={() => handleFetchResults(week.id)}
                      >
                        Fetch Results
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDelete(week.id)}
                      >
                        Delete
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

          <div className="form-row">
            <div className="form-group full-width">
              <label htmlFor="segment_input">
                Segment (Strava URL or ID)
                {formData.segment_name && (
                  <span style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                    - Current: {formData.segment_name}
                    {formData.segment_id && (
                      <>
                        {' '}(
                        <a 
                          href={`https://www.strava.com/segments/${formData.segment_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#f56004' }}
                        >
                          View on Strava
                        </a>
                        )
                      </>
                    )}
                  </span>
                )}
              </label>
              <input
                type="text"
                id="segment_input"
                name="segment_input"
                placeholder="e.g., https://www.strava.com/segments/12744502 or just 12744502"
              />
              <small style={{ color: '#666' }}>
                Paste a Strava segment URL or just the segment ID. Use Segment Finder above if needed.
              </small>
            </div>
          </div>

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

          <div className="form-actions">
            <button type="submit" className="submit-button">
              {editingWeekId ? 'Update Week' : 'Create Week'}
            </button>
            <button type="button" className="cancel-button" onClick={cancelEdit}>
              Cancel
            </button>
            </div>
          </form>
          
          <SegmentSearch onSegmentSelect={handleSegmentSelect} />
          
          <SegmentFinder />
        </div>
      )}
    </div>
  );
}

export default WeekManager;
