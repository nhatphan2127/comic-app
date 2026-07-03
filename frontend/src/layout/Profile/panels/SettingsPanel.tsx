export default function SettingsPanel() {
  return (
    <div className="panel-container">
      <h2 className="panel-title">Settings</h2>
      <p className="panel-subtitle">Control which sections appear on your public profile.</p>

      {/* Khối Profile Visibility */}
      <div className="settings-card">
        <h3 className="card-group-title">Profile visibility</h3>
        <div className="toggle-row">
          <div>
            <h4>Hide wall</h4>
            <p>Visitors can't see or post to the message wall on your profile.</p>
          </div>
          <input type="checkbox" className="toggle-switch" />
        </div>
        <div className="toggle-row">
          <div>
            <h4>Hide recent comments</h4>
            <p>Don't expose comments you've made on titles or chapters publicly.</p>
          </div>
          <input type="checkbox" className="toggle-switch" />
        </div>
      </div>

      {/* Khối Home Page */}
      <div className="settings-card">
        <h3 className="card-group-title">Home page</h3>
        <div className="toggle-row">
          <div>
            <h4>Show following titles</h4>
            <p>Rail of new chapters from comics you follow.</p>
          </div>
          <input type="checkbox" className="toggle-switch" defaultChecked />
        </div>
      </div>
    </div>
  );
}