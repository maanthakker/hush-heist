import SettingsPanel from './SettingsPanel.jsx';

export default function PauseMenu({ party, settings, onSettings, onResume, onQuit, quitLabel = 'Quit to menu' }) {
  return (
    <div className="screen pause-screen">
      <div className="card pause-card" role="dialog" aria-labelledby="pause-title">
        <h2 id="pause-title">{party ? 'Party menu' : 'Paused'}</h2>
        <p>{party ? 'The round keeps going while this is open.' : 'Everyone’s still asleep. For now.'}</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onResume} autoFocus>
            {party ? 'Back to the heist' : 'Resume'}
          </button>
          <button type="button" className="btn ghost" onClick={onQuit}>
            {party ? 'Leave party' : quitLabel}
          </button>
        </div>
        <SettingsPanel settings={settings} onChange={onSettings} compact />
      </div>
    </div>
  );
}
