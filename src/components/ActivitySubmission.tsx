import { useState } from 'react';
import { submitActivity } from '../api';

interface ActivitySubmissionProps {
  weekId: number;
  weekName: string;
  segmentName: string;
  requiredLaps: number;
  onSubmitSuccess: () => void;
}

export default function ActivitySubmission({ 
  weekId, 
  weekName, 
  segmentName, 
  requiredLaps,
  onSubmitSuccess 
}: ActivitySubmissionProps) {
  const [activityUrl, setActivityUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activityUrl.trim()) {
      setError('Please enter a Strava activity URL');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await submitActivity(weekId, { activity_url: activityUrl });
      setSuccess(response.message);
      setActivityUrl('');
      
      // Refresh the leaderboard after successful submission
      setTimeout(() => {
        onSubmitSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="activity-submission">
      <h3>Submit Your Activity</h3>
      <div className="submission-info">
        <p><strong>Week:</strong> {weekName}</p>
        <p><strong>Segment:</strong> {segmentName}</p>
        <p><strong>Required Laps:</strong> {requiredLaps}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="activity-url">Strava Activity URL:</label>
          <input
            id="activity-url"
            type="text"
            value={activityUrl}
            onChange={(e) => setActivityUrl(e.target.value)}
            placeholder="https://www.strava.com/activities/12345678"
            disabled={isSubmitting}
          />
          <small>
            Copy the URL from your Strava activity page (e.g., https://www.strava.com/activities/12345678)
          </small>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <strong>Success!</strong> {success}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting || !activityUrl.trim()}
          className="submit-button"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Activity'}
        </button>
      </form>

      <style>{`
        .activity-submission {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .activity-submission h3 {
          margin-top: 0;
          color: #333;
        }

        .submission-info {
          background: white;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .submission-info p {
          margin: 5px 0;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
          color: #333;
        }

        .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:disabled {
          background-color: #e9ecef;
          cursor: not-allowed;
        }

        .form-group small {
          display: block;
          margin-top: 5px;
          color: #6c757d;
          font-size: 12px;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 15px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 15px;
        }

        .submit-button {
          background: #FC5200;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          background: #e04a00;
        }

        .submit-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
