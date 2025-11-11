import { useState, useEffect } from 'react';
import './SegmentInput.css';
import { getAdminSegments, validateSegment as validateSegmentApi } from '../api';

interface Segment {
  id: number;
  strava_segment_id: number;
  name: string;
}

interface SegmentInputProps {
  value: { id: number; name: string };
  onChange: (segmentId: number, segmentName: string) => void;
}

function SegmentInput({ value, onChange }: SegmentInputProps) {
  const [urlInput, setUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [knownSegments, setKnownSegments] = useState<Segment[]>([]);
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  // Fetch known segments on mount
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const segments = await getAdminSegments();
        setKnownSegments(segments);
      } catch (error) {
        console.error('Failed to fetch known segments:', error);
      }
    };
    fetchSegments();
  }, []);

  // Update internal state when value prop changes
  useEffect(() => {
    if (value.id) {
      setUrlInput(value.id.toString());
      setNameInput(value.name);
      if (value.name) {
        setValidationState('valid');
      }
    }
  }, [value]);

  /**
   * Parse Strava segment URL or ID
   * Accepts:
   * - https://www.strava.com/segments/12744502
   * - https://www.strava.com/segments/12744502?filter=overall
   * - 12744502
   */
  const parseSegmentInput = (input: string): number | null => {
    const trimmed = input.trim();
    
    // If it's just a number
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    
    // If it's a URL, extract segment ID
    const urlMatch = trimmed.match(/segments\/(\d+)/);
    if (urlMatch) {
      return parseInt(urlMatch[1], 10);
    }
    
    return null;
  };

  const validateSegment = async (segmentId: number) => {
    setValidationState('validating');
    setErrorMessage('');
    
    try {
      const segmentData = await validateSegmentApi(segmentId);
      setValidationState('valid');
      onChange(segmentId, segmentData.name);
    } catch (error: any) {
      setValidationState('error');
      setErrorMessage(error.message || 'Invalid segment');
      onChange(0, '');
    }
  };

  const handleUrlBlur = () => {
    if (!urlInput.trim()) {
      setValidationState('idle');
      return;
    }
    
    const segmentId = parseSegmentInput(urlInput);
    if (!segmentId) {
      setValidationState('error');
      setErrorMessage('Invalid segment URL or ID');
      onChange(0, '');
      return;
    }
    
    validateSegment(segmentId);
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setNameInput(input);
    
    if (!input.trim()) {
      setFilteredSegments([]);
      setShowNameDropdown(false);
      return;
    }
    
    // Filter segments by name (case-insensitive)
    const filtered = knownSegments.filter(segment =>
      segment.name.toLowerCase().includes(input.toLowerCase())
    );
    setFilteredSegments(filtered);
    setShowNameDropdown(filtered.length > 0);
  };

  const handleNameSegmentSelect = (segment: Segment) => {
    setUrlInput(segment.strava_segment_id.toString());
    setNameInput(segment.name);
    setValidationState('valid');
    onChange(segment.strava_segment_id, segment.name);
    setShowNameDropdown(false);
  };

  const handleNameInputFocus = () => {
    if (nameInput.trim() && filteredSegments.length > 0) {
      setShowNameDropdown(true);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // Revert to the original value
      setNameInput(value.name);
      setShowNameDropdown(false);
      e.currentTarget.blur();
    }
  };

  const getInputClassName = () => {
    let className = 'segment-url-input';
    if (validationState === 'valid') className += ' valid';
    if (validationState === 'error') className += ' error';
    return className;
  };

  return (
    <div className="segment-input-container">
      <div className="segment-input-row">
        <div className="form-group">
          <label htmlFor="segment_name">Segment Name</label>
          <div className="segment-name-wrapper">
            <input
              type="text"
              id="segment_name"
              className="segment-name-input"
              value={nameInput}
              onChange={handleNameInputChange}
              onFocus={handleNameInputFocus}
              onKeyDown={handleNameKeyDown}
              onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
              placeholder="Type to search known segments or auto-fill from URL"
              autoComplete="off"
            />
            {showNameDropdown && filteredSegments.length > 0 && (
              <div className="name-autocomplete-dropdown">
                {filteredSegments.map((segment) => (
                  <button
                    key={segment.id}
                    type="button"
                    className="segment-option"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      handleNameSegmentSelect(segment);
                    }}
                  >
                    <span className="segment-option-name">{segment.name}</span>
                    <span className="segment-option-id">#{segment.strava_segment_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <small>Type to search known segments, or auto-fills from URL validation</small>
        </div>

        <div className="form-group">
          <label htmlFor="segment_url">
            Segment URL or ID
            {validationState === 'validating' && <span className="validation-spinner"> ⏳</span>}
            {validationState === 'valid' && <span className="validation-success"> ✓</span>}
            {validationState === 'error' && <span className="validation-error"> ✗</span>}
          </label>
          <input
            type="text"
            id="segment_url"
            className={getInputClassName()}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="e.g., https://www.strava.com/segments/12744502 or just 12744502"
            autoComplete="off"
          />
          {errorMessage && <small className="error-text">{errorMessage}</small>}
          {!errorMessage && (
            <small>
              Paste a Strava segment URL or ID. Query params (like ?filter=overall) are automatically stripped.
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

export default SegmentInput;
