import { useState } from 'react';
import './SeasonManager.css';
import { trpc } from '../utils/trpc';
import type { Season } from 'server/src/db/schema';
import { formatUnixDate, dateToUnixStart, dateToUnixEnd, unixToDateLocal } from '../utils/dateUtils';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

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

  const [isCreating, setIsCreating] = useState(false);
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
        is_active: false // Default to false, logic handled by backend/service if needed
      };

      if (editingSeasonId) {
        await updateMutation.mutateAsync({
          id: editingSeasonId,
          data: submitData
        });
      } else {
        await createMutation.mutateAsync(submitData);
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
          <table className="seasons-table">
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
                const now = Math.floor(Date.now() / 1000);
                const isWithinDates = season.start_at <= now && now <= season.end_at;
                return (
                <tr key={season.id}>
                  <td>{season.name}</td>
                  <td>{formatUnixDate(season.start_at)}</td>
                  <td>{formatUnixDate(season.end_at)}</td>
                  <td>
                    <span className={`status-badge ${isWithinDates ? 'active' : 'inactive'}`}>
                      {isWithinDates ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="icon-button season-action-edit"
                        onClick={() => handleEdit(season)}
                        title="Edit season"
                      >
                        <PencilIcon width={28} height={28} />
                      </button>
                      <button
                        className="icon-button season-action-delete"
                        onClick={() => handleDelete(season.id)}
                        title="Delete season"
                      >
                        <TrashIcon width={28} height={28} />
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

      {!isCreating && (
        <button
          className="create-button"
          onClick={() => setIsCreating(true)}
        >
          + Create New Season
        </button>
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
