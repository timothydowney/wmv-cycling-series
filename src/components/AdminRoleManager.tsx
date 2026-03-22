import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthStatus } from '../api';
import { trpc } from '../utils/trpc';
import './AdminRoleManager.css';

type AdminCandidate = {
  id: number;
  name: string;
  strava_athlete_id: string;
  has_token: boolean;
  token_expires_at?: string;
  is_admin: boolean;
  is_env_admin: boolean;
  is_db_admin: boolean;
  effective_is_admin: boolean;
  profile_picture_url?: string | null;
};

function AdminRoleManager() {
  const utils = trpc.useUtils();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const { data, isLoading, error } = trpc.participant.getAdminCandidates.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  const updateAdminStatus = trpc.participant.setAdminStatus.useMutation({
    onSuccess: () => {
      utils.participant.getAdminCandidates.invalidate();
      utils.participant.getAll.invalidate();
      utils.participant.getAllWithStatus.invalidate();
      utils.participant.getAuthStatus.invalidate();
    },
  });

  const participants = useMemo(() => (data || []) as AdminCandidate[], [data]);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const status = await getAuthStatus();
        setIsAdmin(status.is_admin || false);
      } catch (authError) {
        console.error('Failed to check admin status:', authError);
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAdmin();
  }, []);

  if (authLoading) {
    return <div className="admin-role-manager">Loading admin roles...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-role-manager">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Access Denied</h2>
          <p>You do not have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="admin-role-manager">Loading admin roles...</div>;
  }

  if (error) {
    return <div className="admin-role-manager error">{error.message}</div>;
  }

  return (
    <section className="admin-role-manager">
      <div className="admin-role-header">
        <div>
          <h3>Admin Roles</h3>
          <p>Grant or revoke database-backed admin access for participants who have logged in.</p>
        </div>
        <div className="admin-role-summary">
          <span>{participants.filter(participant => participant.effective_is_admin).length} effective admins</span>
          <span>{participants.filter(participant => participant.is_env_admin).length} env-backed</span>
        </div>
      </div>

      <table className="admin-role-table wmv-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Strava ID</th>
            <th>Source</th>
            <th>Access</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {participants.map(participant => {
            const disableRevoke = participant.is_env_admin;
            const isBusy = updateAdminStatus.isPending && updateAdminStatus.variables?.stravaAthleteId === participant.strava_athlete_id;

            return (
              <tr key={participant.strava_athlete_id}>
                <td className="admin-role-name-cell">
                  <span className="admin-role-name">{participant.name}</span>
                </td>
                <td>
                  <Link to={`/profile/${participant.strava_athlete_id}`} className="admin-role-link">
                    {participant.strava_athlete_id}
                  </Link>
                </td>
                <td>
                  <div className="admin-role-tags">
                    {participant.is_env_admin && <span className="admin-role-tag env">Env</span>}
                    {participant.is_db_admin && <span className="admin-role-tag db">Database</span>}
                    {!participant.is_env_admin && !participant.is_db_admin && <span className="admin-role-tag">None</span>}
                  </div>
                </td>
                <td>
                  <span className={`admin-role-status ${participant.effective_is_admin ? 'enabled' : 'disabled'}`}>
                    {participant.effective_is_admin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>
                  {participant.effective_is_admin ? (
                    <button
                      type="button"
                      className="admin-role-button revoke"
                      disabled={disableRevoke || isBusy}
                      onClick={() => updateAdminStatus.mutate({
                        stravaAthleteId: participant.strava_athlete_id,
                        isAdmin: false,
                      })}
                      title={disableRevoke ? 'Env-backed admins must be removed via ADMIN_ATHLETE_IDS' : 'Revoke database-backed admin access'}
                    >
                      {isBusy ? 'Saving...' : disableRevoke ? 'Managed via env' : 'Revoke'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-role-button grant"
                      disabled={isBusy}
                      onClick={() => updateAdminStatus.mutate({
                        stravaAthleteId: participant.strava_athlete_id,
                        isAdmin: true,
                      })}
                    >
                      {isBusy ? 'Saving...' : 'Grant'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="admin-role-help">
        Env-backed admins remain admins even if database access is revoked here. Remove them from <code>ADMIN_ATHLETE_IDS</code> to fully revoke access.
      </p>
    </section>
  );
}

export default AdminRoleManager;