import { Strava } from 'strava-api-client';

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
  
  const strava = new Strava({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: window.location.origin,
  });

  const tokenData = await strava.oauth.getToken({ code });
  return tokenData;
};

export const getSegmentLeaderboard = async (accessToken: string, segmentId: number) => {
  const strava = new Strava({ access_token: accessToken });
  const leaderboard = await strava.segments.getLeaderboard({ id: segmentId });
  return leaderboard;
};
