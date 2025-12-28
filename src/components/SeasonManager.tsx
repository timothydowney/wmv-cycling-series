import { useState, useMemo } from 'react';
import './SeasonManager.css';
import { trpc } from '../utils/trpc';
import type { Season } from 'server/src/db/schema';
import { formatUnixDate, dateToUnixStart, dateToUnixEnd, unixToDateLocal } from '../utils/dateUtils';
import { PencilIcon, TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { WeeklyHeader } from './WeeklyHeader';
import { NotesDisplay } from './NotesDisplay';

interface SeasonFormData {
  name: string;
  start_at: string;  // date format YYYY-MM-DD
  end_at: string;    // date format YYYY-MM-DD
}

interface Props {
  onSeasonsChanged?: () => void;  // Callback to refresh seasons in parent
}

function SeasonManager({ onSeasonsChanged }: Props) {
  const utils = trpc.useUtils();
  const { data: seasons = [] } = trpc.season.getAll.useQuery();

  const createMutation = trpc.season.create.useMutation({
    onSuccess: () => {
      utils.season.getAll.invalidate();
      if (onSeasonsChanged) onSeasonsChanged();
    }
  });

  const updateMutation = trpc.season.update.useMutation({
    onSuccess: () => {
      utils.season.getAll.invalidate();
      if (onSeasonsChanged) onSeasonsChanged();
    }
  });

  const deleteMutation = trpc.season.delete.useMutation({
    onSuccess: () => {
      utils.season.getAll.invalidate();
      if (onSeasonsChanged) onSeasonsChanged();
    }
  });

  const cloneMutation = trpc.season.clone.useMutation({
    onSuccess: () => {
      utils.season.getAll.invalidate();
      if (onSeasonsChanged) onSeasonsChanged();
      setMessage({ type: 'success', text: 'Season cloned successfully!' });
      setIsCloning(false);
      setCloneSourceId(null);
      setCloneStartDate('');
      setCloneNewName('');
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<number | null>(null);
  const [cloneStartDate, setCloneStartDate] = useState('');
  const [cloneNewName, setCloneNewName] = useState('');
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<number[]>([]);

  const { data: sourceWeeks = [] } = trpc.week.getAll.useQuery(
    { seasonId: cloneSourceId || 0 },
    { enabled: !!cloneSourceId }
  );

  const togglePreviewExpand = (index: number) => {
    setExpandedPreviewIds(prev => 
      prev.includes(index) 
        ? prev.filter(id => id !== index)
        : [...prev, index]
    );
  };

  const previewWeeks = useMemo(() => {
    if (!cloneSourceId || !cloneStartDate || !sourceWeeks.length) return [];
    
    const sourceSeason = seasons.find(s => s.id === cloneSourceId);
    if (!sourceSeason) return [];

    // Sort weeks by start date to ensure correct order and offset calculation
    const sortedWeeks = [...sourceWeeks].sort((a, b) => a.start_at - b.start_at);
    const firstWeekStart = sortedWeeks[0].start_at;

    // Calculate time-of-day of the first week to preserve it
    const firstWeekMidnight = dateToUnixStart(unixToDateLocal(firstWeekStart));
    const timeOfDay = firstWeekStart - firstWeekMidnight;
    
    // New start time = Selected Date Midnight + Original Time of Day
    const targetDateMidnight = dateToUnixStart(cloneStartDate);
    const newStartUnix = targetDateMidnight + timeOfDay;

    return sortedWeeks.map(w => {
      // Calculate offset in DAYS relative to the FIRST WEEK
      // This avoids DST shift issues by snapping to exact 24-hour intervals
      const diffSeconds = w.start_at - firstWeekStart;
      const daysDiff = Math.round(diffSeconds / 86400);
      
      const duration = w.end_at - w.start_at;
      
      // New start is exactly N days after the first week's new start
      const newStart = newStartUnix + (daysDiff * 86400);
      const newEnd = newStart + duration;
      
      return {
        ...w,
        newStart,
        newEnd
      };
    });
  }, [cloneSourceId, cloneStartDate, sourceWeeks, seasons]);

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceId || !cloneStartDate || !cloneNewName) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    // We need to calculate the exact start timestamp (including time of day)
    // just like we did for the preview
    const sourceWeeksSorted = [...sourceWeeks].sort((a, b) => a.start_at - b.start_at);
    if (sourceWeeksSorted.length === 0) {
       // Fallback if no weeks (shouldn't happen if cloning a valid season)
       const newStartUnix = dateToUnixStart(cloneStartDate);
       await cloneMutation.mutateAsync({
        sourceSeasonId: cloneSourceId,
        newStartDate: newStartUnix,
        newName: cloneNewName
      });
      return;
    }

    const firstWeekStart = sourceWeeksSorted[0].start_at;
    const firstWeekMidnight = dateToUnixStart(unixToDateLocal(firstWeekStart));
    const timeOfDay = firstWeekStart - firstWeekMidnight;
    
    const targetDateMidnight = dateToUnixStart(cloneStartDate);
    const newStartUnix = targetDateMidnight + timeOfDay;
    
    await cloneMutation.mutateAsync({
      sourceSeasonId: cloneSourceId,
      newStartDate: newStartUnix,
      newName: cloneNewName
    });
  };
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);
  const [formData, setFormData] = useState<SeasonFormData>({
    name: '',
    start_at: '',
    end_at: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate fields
    if (!formData.name || !formData.start_at || !formData.end_at) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    const startUnix = dateToUnixStart(formData.start_at);
    const endUnix = dateToUnixEnd(formData.end_at);

    if (startUnix > endUnix) {
      setMessage({ type: 'error', text: 'Start date must be before or equal to end date' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    try {
      const submitData = {
        name: formData.name,
        start_at: startUnix,
        end_at: endUnix,
        is_active: editingSeasonId ? undefined : true // Default to true on create, unless specifically toggled later
      };

      if (editingSeasonId) {
        await updateMutation.mutateAsync({
          id: editingSeasonId,
          data: {
            name: formData.name,
            start_at: startUnix,
            end_at: endUnix
          }
        });
      } else {
        await createMutation.mutateAsync({
          ...submitData,
          is_active: true
        });
      }

      setMessage({
        type: 'success',
        text: editingSeasonId ? 'Season updated successfully!' : 'Season created successfully!'
      });

      // Reset form
      setIsCreating(false);
      setEditingSeasonId(null);
      setFormData({
        name: '',
        start_at: '',
        end_at: ''
      });

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleEdit = (season: Season) => {
    setFormData({
      name: season.name,
      start_at: unixToDateLocal(season.start_at),
      end_at: unixToDateLocal(season.end_at)
    });
    setEditingSeasonId(season.id);
    setIsCreating(true);
  };

  const handleToggleStatus = async (season: Season) => {
    const newStatus = season.is_active === 1 ? false : true;

    try {
      await updateMutation.mutateAsync({
        id: season.id,
        data: {
          is_active: newStatus
        }
      });
      // No message shown on success as requested
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDelete = async (seasonId: number) => {
    if (!confirm('Are you sure you want to delete this season? This will also delete all associated weeks.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(seasonId);

      setMessage({ type: 'success', text: 'Season deleted successfully!' });

      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingSeasonId(null);
    setFormData({
      name: '',
      start_at: '',
      end_at: ''
    });
    setIsCloning(false);
    setCloneSourceId(null);
    setCloneStartDate('');
    setCloneNewName('');
  };

  return (
    <div className="season-manager">
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="seasons-list">
        <h3>Seasons</h3>
        {seasons.length === 0 ? (
          <p className="no-seasons">No seasons created yet. Create your first season below.</p>
        ) : (
          <table className="seasons-table wmv-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(season => {
                const isActive = season.is_active === 1;

                return (
                  <tr key={season.id}>
                    <td>{season.name}</td>
                    <td>{formatUnixDate(season.start_at)}</td>
                    <td>{formatUnixDate(season.end_at)}</td>
                    <td>
                      <div className="status-toggle-wrapper">
                        <span className={`status-label-text ${isActive ? 'active' : 'closed'}`}>
                          {isActive ? 'Active' : 'Closed'}
                        </span>
                        <button
                          className={`season-toggle-switch ${isActive ? 'active' : 'closed'}`}
                          onClick={() => handleToggleStatus(season)}
                          title={isActive ? "Click to Close Season" : "Click to Activate Season"}
                        >
                          <div className="season-toggle-button" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-button season-action-edit"
                          onClick={() => handleEdit(season)}
                          title="Edit season"
                        >
                          <PencilIcon width={24} height={24} />
                        </button>
                        <button
                          className="icon-button season-action-delete"
                          onClick={() => handleDelete(season.id)}
                          title="Delete season"
                        >
                          <TrashIcon width={24} height={24} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!isCreating && !isCloning && (
        <div className="season-actions-row" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            className="create-button"
            onClick={() => setIsCreating(true)}
          >
            + Create New Season
          </button>
          <button
            className="create-button"
            onClick={() => setIsCloning(true)}
            style={{ backgroundColor: '#4a5568' }}
          >
            <DocumentDuplicateIcon width={20} height={20} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
            Clone a Season
          </button>
        </div>
      )}

      {isCloning && (
        <div className="season-creation-area">
          <form className="season-form" onSubmit={handleCloneSubmit}>
            <h3>Clone a Season</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sourceSeason">Source Season</label>
                <select
                  id="sourceSeason"
                  value={cloneSourceId || ''}
                  onChange={(e) => setCloneSourceId(Number(e.target.value))}
                  required
                  className="form-select"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select a season to clone...</option>
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cloneNewName">New Season Name</label>
                <input
                  type="text"
                  id="cloneNewName"
                  value={cloneNewName}
                  onChange={(e) => setCloneNewName(e.target.value)}
                  required
                  placeholder="e.g., Spring 2026"
                />
              </div>
              <div className="form-group">
                <label htmlFor="cloneStartDate">New Start Date</label>
                <input
                  type="date"
                  id="cloneStartDate"
                  value={cloneStartDate}
                  onChange={(e) => setCloneStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {previewWeeks.length > 0 && (
              <div className="clone-preview" style={{ marginTop: '20px', marginBottom: '20px' }}>
                <h4>Preview: {previewWeeks.length} Weeks</h4>
                <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '4px' }}>
                  {previewWeeks.map((w, i) => {
                    const isExpanded = expandedPreviewIds.includes(i);
                    return (
                      <div key={i} style={{ marginBottom: isExpanded ? '16px' : '24px' }}>
                        <WeeklyHeader 
                          week={{
                            ...w, 
                            start_at: w.newStart, 
                            end_at: w.newEnd
                          }} 
                          weekNumber={i + 1}
                          onClick={() => togglePreviewExpand(i)}
                          isExpanded={isExpanded}
                        />
                        {isExpanded && (
                          <div style={{
                            marginTop: '-24px',
                            marginLeft: '16px',
                            marginRight: '16px',
                            backgroundColor: '#f9fafb',
                            borderBottomLeftRadius: '16px',
                            borderBottomRightRadius: '16px',
                            border: '1px solid #e5e7eb',
                            borderTop: 'none',
                            padding: '24px',
                            paddingTop: '32px',
                            animation: 'slideDown 0.2s ease-out',
                            position: 'relative',
                            zIndex: 0
                          }}>
                            {w.notes ? (
                              <NotesDisplay markdown={w.notes} />
                            ) : (
                              <div style={{ color: 'var(--wmv-text-light)', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                                No notes for this week.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={cancelEdit}>
                Cancel
              </button>
              <button type="submit" className="submit-button" disabled={cloneMutation.isPending}>
                {cloneMutation.isPending ? 'Cloning...' : 'Clone Season'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isCreating && (
        <div className="season-creation-area">
          <form className="season-form" onSubmit={handleSubmit}>
            <h3>{editingSeasonId ? 'Edit Season' : 'Create New Season'}</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Season Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Fall 2025"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_at">Start Date</label>
                <input
                  type="date"
                  id="start_at"
                  name="start_at"
                  value={formData.start_at}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_at">End Date</label>
                <input
                  type="date"
                  id="end_at"
                  name="end_at"
                  value={formData.end_at}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>


            <div className="form-actions">
              <button type="submit" className="submit-button">
                {editingSeasonId ? 'Update Season' : 'Create Season'}
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

export default SeasonManager;
