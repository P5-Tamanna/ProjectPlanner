import React, { useEffect } from "react";
import "./App.css";
import TimelineCalendar from "./components/TimelineCalendar";

function App() {
  useEffect(() => {
    // Auto-seed demo data in development if not already seeded
    try {
      const seeded = localStorage.getItem("demoSeeded");
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (!seeded && isLocal) {
        fetch("http://127.0.0.1:5000/api/seed-demo", { method: "POST" })
          .then((res) => res.json())
          .then(() => localStorage.setItem("demoSeeded", "1"))
          .catch((err) => console.warn("Seed failed", err));
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">DevAI Portal</div>
        <div className="user">Ms. Sonal Jain <span className="role">Guide</span></div>
      </header>

      <div className="app-top-cards">
        <div className="card"> <div className="card-value">85%</div> <div className="card-label">Overall Progress</div> </div>
        <div className="card"> <div className="card-value">32</div> <div className="card-label">Total Group Commits</div> </div>
        <div className="card"> <div className="card-value">1 / 5</div> <div className="card-label">Tasks Completed</div> </div>
      </div>

      <div className="app-content">
        <main className="main-area">
          <h2 className="page-title">Group A-08: DevGuide AI</h2>
          <TimelineCalendar />
        </main>

        <aside className="assistant-panel">
          <div className="assistant-card">
            <h3>AI Assistant</h3>
            <div className="assistant-msg">Hello! I am DevAI, your context-aware project assistant. Ask me anything about your project.</div>
              <div className="assistant-input">
                <input placeholder="Ask DevAI a question..." />
                <button>→</button>
              </div>
              <div style={{ marginTop:12 }}>
                <button onClick={async ()=>{
                  if (!window.confirm('Reset demo data? This will remove and reseed demo milestones.')) return;
                  try {
                    const resp = await fetch('/api/reset-demo', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ project_id: '1234' }) });
                    const ct = resp.headers.get('content-type') || '';
                    if (!resp.ok) {
                      // try to read text or json for helpful message
                      if (ct.indexOf('application/json') !== -1) {
                        const j = await resp.json();
                        throw new Error(j.error || j.message || `Status ${resp.status}`);
                      } else {
                        const t = await resp.text();
                        throw new Error(t || `Status ${resp.status}`);
                      }
                    }
                    if (ct.indexOf('application/json') !== -1) {
                      await resp.json();
                    } else {
                      // backend returned HTML (likely a 404 fallback). Treat as failure.
                      const txt = await resp.text();
                      throw new Error('Unexpected non-JSON response from server: ' + (txt && txt.slice ? txt.slice(0,200) : '')); 
                    }
                    alert('Demo reset completed');
                    window.location.reload();
                  } catch (err) {
                    console.error('Reset failed', err);
                    alert('Reset failed: ' + (err.message||err));
                  }
                }} style={{ background:'#eae6ff', border:'none', padding:'8px 12px', borderRadius:8, cursor:'pointer' }}>Reset Demo</button>
              </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
