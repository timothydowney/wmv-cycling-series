interface SegmentMetadataPayload {
  name: string;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_grade?: number | null;
  climb_category?: number | null;
  start_latitude?: number | null;
  start_longitude?: number | null;
  end_latitude?: number | null;
  end_longitude?: number | null;
  metadata_updated_at?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

const SEGMENT_METADATA_FIXTURES: Record<string, SegmentMetadataPayload> = {
  '2234642': {
    name: 'Box Hill KOM',
    distance: 2476.8,
    total_elevation_gain: 116.2,
    average_grade: 4.7,
    climb_category: 3,
    start_latitude: 51.2526,
    start_longitude: -0.3212,
    end_latitude: 51.2427,
    end_longitude: -0.3148,
    metadata_updated_at: '2026-04-19T12:00:00Z',
    city: 'Dorking',
    state: 'Surrey',
    country: 'United Kingdom',
  },
  '12345': {
    name: 'Champs-Elysees Sprint',
    distance: 1200,
    total_elevation_gain: 6,
    average_grade: 0.5,
    climb_category: 0,
    start_latitude: 48.8698,
    start_longitude: 2.3078,
    end_latitude: 48.8655,
    end_longitude: 2.3212,
    metadata_updated_at: '2026-04-19T12:00:00Z',
    city: 'Paris',
    state: 'Ile-de-France',
    country: 'France',
  },
  '12744502': {
    name: 'WMV Explorer Test Climb',
    distance: 1832.4,
    total_elevation_gain: 84.6,
    average_grade: 4.1,
    climb_category: 4,
    start_latitude: 42.3172,
    start_longitude: -72.6425,
    end_latitude: 42.3251,
    end_longitude: -72.6184,
    metadata_updated_at: '2026-04-19T12:00:00Z',
    city: 'Northampton',
    state: 'MA',
    country: 'USA',
  },
};

function getFixtureSegmentMetadata(segmentId: string): SegmentMetadataPayload | null {
  return SEGMENT_METADATA_FIXTURES[segmentId] || null;
}

export { getFixtureSegmentMetadata, SEGMENT_METADATA_FIXTURES };
export type { SegmentMetadataPayload };