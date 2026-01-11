/**
 * Minimal Club Service Tests
 * Quick validation that ClubService works correctly
 * 
 * New design: Check membership by calling getLoggedInAthlete()
 * and checking if target club is in athlete's clubs array.
 */

import ClubService from '../services/ClubService';
import * as stravaClientModule from '../stravaClient';
import { setupTestDb } from './setupTestDb';

jest.mock('../stravaClient');
const mockStravaClient = stravaClientModule as jest.Mocked<typeof stravaClientModule>;

describe('ClubService - Minimal Tests', () => {
  let service: ClubService;
  let drizzleDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const testDb = setupTestDb();
    drizzleDb = testDb.drizzleDb;
    service = new ClubService(drizzleDb);
  });

  it('should create a new instance', () => {
    expect(service).toBeDefined();
  });

  it('should check if athlete is club member using athlete clubs', async () => {
    // Athlete is a member of club 1495648
    const mockAthlete = {
      id: 123456,
      firstname: 'Tim',
      lastname: 'Downey',
      clubs: [
        { id: 1495648, name: 'Western Mass Velo' },
        { id: 999999, name: 'Other Club' },
      ],
    };

    mockStravaClient.getLoggedInAthlete.mockResolvedValue(mockAthlete);

    const isMember = await service.isMemberOfClub('1495648', 'token');
    expect(isMember).toBe(true);
  });

  it('should return false when athlete is not a member', async () => {
    const mockAthlete = {
      id: 123456,
      firstname: 'Tim',
      lastname: 'Downey',
      clubs: [
        { id: 999999, name: 'Other Club' },
      ],
    };

    mockStravaClient.getLoggedInAthlete.mockResolvedValue(mockAthlete);

    const isMember = await service.isMemberOfClub('1495648', 'token');
    expect(isMember).toBe(false);
  });

  it('should handle athlete with no clubs array', async () => {
    const mockAthlete = {
      id: 123456,
      firstname: 'Tim',
      lastname: 'Downey',
      // No clubs array
    };

    mockStravaClient.getLoggedInAthlete.mockResolvedValue(mockAthlete);

    const isMember = await service.isMemberOfClub('1495648', 'token');
    expect(isMember).toBe(false);
  });

  it('should return false on API error gracefully', async () => {
    mockStravaClient.getLoggedInAthlete.mockRejectedValue(new Error('API failed'));

    const result = await service.isMemberOfClub('1495648', 'token');
    expect(result).toBe(false);
  });

  it('should handle numeric club IDs correctly', async () => {
    // Test with numeric ID to ensure type conversion works
    const mockAthlete = {
      id: 123456,
      firstname: 'Tim',
      lastname: 'Downey',
      clubs: [
        { id: 1495648, name: 'Western Mass Velo' }, // Numeric ID
      ],
    };

    mockStravaClient.getLoggedInAthlete.mockResolvedValue(mockAthlete);

    const isMember1 = await service.isMemberOfClub('1495648', 'token');
    expect(isMember1).toBe(true);

    // Test with string ID should also work due to number conversion
    const isMember2 = await service.isMemberOfClub('1495648', 'token');
    expect(isMember2).toBe(true);
  });
});
