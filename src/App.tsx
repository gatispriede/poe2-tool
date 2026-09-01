import React, { useState } from 'react';
import './App.css';
import BuildPlanner from './components/BuildPlanner/BuildPlanner';
import Explorer from './components/Explorer/Explorer';
import MechanicsDiscovery from './components/MechanicsDiscovery/MechanicsDiscovery';
import SkillLab from './components/SkillLab';

type View = 'lab' | 'explorer' | 'planner' | 'mechanics';

function App() {
  const [view, setView] = useState<View>('lab');

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-brand">PoE 2 Build Workbench</div>
        <div className="app-nav-tabs">
          <button
            className={`app-nav-tab ${view === 'lab' ? 'active' : ''}`}
            onClick={() => setView('lab')}
          >
            Skill Lab
          </button>
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
        {view === 'lab' && <SkillLab />}
        {view === 'explorer' && <Explorer />}
        {view === 'planner' && <BuildPlanner />}
        {view === 'mechanics' && <MechanicsDiscovery />}
      </main>
    </div>
  );
}

export default App;
