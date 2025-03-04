import React from 'react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  return (
    <div className="tab-navigation">
      <button 
        className={`tab-button ${activeTab === 'dof' ? 'active' : ''}`}
        onClick={() => setActiveTab('dof')}
      >
        <div className="tab-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>
        Depth of Field Calculator
      </button>
      <button 
        className={`tab-button ${activeTab === 'photogrammetry' ? 'active' : ''}`}
        onClick={() => setActiveTab('photogrammetry')}
      >
        <div className="tab-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </div>
        Photogrammetry Planner
      </button>
      <button 
        className={`tab-button ${activeTab === 'scenePreview' ? 'active' : ''}`}
        onClick={() => setActiveTab('scenePreview')}
      >
        <div className="tab-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        Scene Preview <span className="beta-badge">BETA</span>
      </button>
    </div>
  );
};

export default TabNavigation; 