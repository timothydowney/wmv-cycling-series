import { Strava, Scope } from 'strava-api-client';

const getStravaCredentials = async () => {
  const res = await fetch('/strava-credentials.json');
  const creds = await res.json();
  return creds;
};

export const redirectToStrava = async () => {
  const { clientId } = await getStravaCredentials();
  const redirectUrl = window.location.origin;
  const scope = 'read,activity:read';
  window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUrl}&approval_prompt=force&scope=${scope}`;
};

export const getAccessToken = async (code: string) => {
  const { clientId, clientSecret } = await getStravaCredentials();

  // Instantiate Strava client with required OAuth configuration (scopes array required)
  const strava = new Strava({
    client_id: String(clientId),
    client_secret: String(clientSecret),
    redirect_uri: window.location.origin,
    scopes: [Scope.READ, Scope.ACTIVITY_READ]
  });

  // Exchange authorization code for access token
  const tokenData = await strava.oauth.token(code);
  return tokenData; // IOAuthResponse
};

export const getSegmentLeaderboard = async (accessToken: string, segmentId: number) => {
  // Library does not expose a direct leaderboard helper; we fetch segment details as a placeholder.
  // If leaderboard data is needed later, implement a direct fetch to Strava's REST API.
  const { clientId, clientSecret } = await getStravaCredentials();
  const strava = new Strava({
    client_id: String(clientId),
    client_secret: String(clientSecret),
    redirect_uri: window.location.origin,
    scopes: [Scope.READ]
  });
  await strava.oauth.set(accessToken);
  const segmentDetails = await strava.segment.get(segmentId);
  return segmentDetails;
};
