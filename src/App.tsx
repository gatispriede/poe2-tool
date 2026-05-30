import React, { useState } from 'react';
import './App.css';
import BuildPlanner from './components/BuildPlanner/BuildPlanner';
import Explorer from './components/Explorer/Explorer';
import MechanicsDiscovery from './components/MechanicsDiscovery/MechanicsDiscovery';

type View = 'explorer' | 'planner' | 'mechanics';

function App() {
  const [view, setView] = useState<View>('explorer');

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-brand">PoE 2 Build Workbench</div>
        <div className="app-nav-tabs">
          <button
            className={`app-nav-tab ${view === 'explorer' ? 'active' : ''}`}
            onClick={() => setView('explorer')}
          >
            Explorer
          </button>
          <button
            className={`app-nav-tab ${view === 'planner' ? 'active' : ''}`}
            onClick={() => setView('planner')}
          >
            Manual Planner
          </button>
          <button
            className={`app-nav-tab ${view === 'mechanics' ? 'active' : ''}`}
            onClick={() => setView('mechanics')}
          >
            Mechanics
          </button>
        </div>
      </nav>
      <main>
        {view === 'explorer' && <Explorer />}
        {view === 'planner' && <BuildPlanner />}
        {view === 'mechanics' && <MechanicsDiscovery />}
      </main>
    </div>
  );
}

export default App;
