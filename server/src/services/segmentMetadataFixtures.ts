interface SegmentMetadataPayload {
  name: string;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_grade?: number | null;
  climb_category?: number | null;
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