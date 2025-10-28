import React, { useEffect, useState, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
// FullCalendar CSS is intentionally left out to avoid package export issues in this environment.
// You can add FullCalendar provided CSS files or include a CDN link in `public/index.html` if desired.
import "./TimelineCalendar.css";
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "../api";

const defaultProjectId = "1234";

function formatForCalendar(items = []) {
  return items.map((item) => ({
    id: item._id || item.id,
    title: item.title,
    start: item.start_date || item.start,
    end: item.end_date || item.end,
    extendedProps: {
      is_milestone: item.is_milestone,
      description: item.description || "",
      priority: item.priority || "Medium",
      completed: item.completed || false,
      progress: item.progress || 0,
      notes: item.notes || "",
      attachments: item.attachments || [],
      reminder_time: item.reminder_time || null,
    },
    backgroundColor: item.is_milestone ? (item.priority === "High" ? "#ef4444" : item.priority === "Low" ? "#34d399" : "#2563eb") : "#f97316",
    borderColor: "transparent",
  }));
}

export default function TimelineCalendar({ projectId = defaultProjectId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: "",
    start_date: "",
    end_date: "",
    project_id: projectId,
    is_milestone: true,
  });

  const [filter, setFilter] = useState("all"); // all/completed/pending
  const [sortBy, setSortBy] = useState("date");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const fileInputRef = useRef(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
  const items = await getMilestones(projectId);
  setEvents(formatForCalendar(items || []));
    } catch (err) {
      console.error("Failed to fetch milestones", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title || !form.start_date) return;
    setAdding(true);
    try {
      await createMilestone(form);
      setForm({ ...form, title: "", start_date: "", end_date: "" });
      await loadEvents();
    } catch (err) {
      // show helpful error message
      console.error("Create milestone error:", err);
      let message = 'Failed to add milestone';
      if (err && err.response) {
        try {
          message = err.response.data?.error || err.response.data?.message || JSON.stringify(err.response.data);
        } catch (e) {
          message = err.response.statusText || `Status ${err.response.status}`;
        }
      } else if (err && err.message) {
        message = err.message;
      }
      alert(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this milestone?")) return;
    try {
      await deleteMilestone(id);
      loadEvents();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  const handleToggleComplete = async (id, current) => {
    try {
      await updateMilestone(id, { completed: !current });
      loadEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (ev) => {
    // ensure subtasks array exists on selected for the editor
    const copy = {
      ...ev,
      extendedProps: {
        ...(ev.extendedProps || {}),
        subtasks: (ev.extendedProps && ev.extendedProps.subtasks) || [],
      },
    };
    setSelected(copy);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    // include subtasks and auto-calc progress
    const subtasks = (selected.extendedProps && selected.extendedProps.subtasks) || [];
    let progress = selected.extendedProps.progress || 0;
    if (subtasks.length > 0) {
      const done = subtasks.filter((s) => s.done).length;
      progress = Math.round((done / subtasks.length) * 100);
    }
    const payload = {
      title: selected.title,
      description: selected.extendedProps.description,
      start_date: selected.start,
      end_date: selected.end,
      priority: selected.extendedProps.priority,
      completed: selected.extendedProps.completed,
      progress,
      notes: selected.extendedProps.notes,
      reminder_time: selected.extendedProps.reminder_time,
      subtasks,
    };
    try {
      await updateMilestone(selected.id, payload);
      // handle attachments upload
      const files = fileInputRef.current ? fileInputRef.current.files : null;
      if (files && files.length) {
        for (let i = 0; i < files.length; i++) {
          const formData = new FormData();
          formData.append("file", files[i]);
          await fetch(`/api/milestones/${selected.id}/attachments`, { method: "POST", body: formData });
        }
      }
      loadEvents();
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    }
  };

  // Notifications: simple in-app alerts for upcoming deadlines
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      const msgs = [];
      (events || []).forEach((ev) => {
        const evDate = ev.start ? new Date(ev.start) : null;
        const completed = ev.extendedProps && ev.extendedProps.completed;
        if (evDate && !completed && evDate > now && evDate <= soon) {
          msgs.push({ id: ev.id, text: `Upcoming: ${ev.title} on ${ev.start}` });
        }
        if (evDate && !completed && evDate < now) {
          msgs.push({ id: ev.id, text: `Overdue: ${ev.title} (was ${ev.start})` });
        }
      });
      setNotifications(msgs);
    };
    checkNotifications();
    const t = setInterval(checkNotifications, 60 * 1000);
    return () => clearInterval(t);
  }, [events]);

  const onEventDrop = async (info) => {
    const id = info.event.id;
    const payload = {
      start_date: info.event.startStr,
      end_date: info.event.endStr || info.event.startStr,
    };
    try {
      await updateMilestone(id, payload);
      loadEvents();
    } catch (err) {
      console.error(err);
      alert("Failed to update event date");
      info.revert();
    }
  };

  return (
    <div className="timeline-root">
      <aside className="timeline-sidebar">
        <h2>Milestones</h2>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '6px', borderRadius:6, border:'1px solid #e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Sort: Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>

        <form className="milestone-form" onSubmit={handleAdd}>
          <input
            className="input-text"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="date-row">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.is_milestone}
                onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })}
              />
              Milestone
            </label>
            <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
        </form>

        <div className="milestone-list">
          {loading ? (
            <div className="muted">Loading...</div>
          ) : events.length === 0 ? (
            <div className="muted">No milestones yet</div>
          ) : (
            // apply search/filter/sort
            events
              .filter((ev) => {
                if (filter === 'completed') return ev.extendedProps.completed;
                if (filter === 'pending') return !ev.extendedProps.completed;
                return true;
              })
              .filter((ev) => ev.title.toLowerCase().includes(search.toLowerCase()))
              .sort((a,b) => {
                if (sortBy === 'priority') {
                  const order = { 'High': 0, 'Medium': 1, 'Low': 2 };
                  return (order[a.extendedProps.priority]||3) - (order[b.extendedProps.priority]||3);
                }
                return new Date(a.start || 0) - new Date(b.start || 0);
              })
              .map((ev) => (
                <div key={ev.id} className="milestone-item">
                  <div className="color" style={{ background: ev.backgroundColor }} />
                  <div className="meta">
                    <div className="title">{ev.title} {ev.extendedProps.priority ? <small style={{color:'#6b7280', marginLeft:6}}>[{ev.extendedProps.priority}]</small> : null}</div>
                    <div className="dates">
                      {ev.start}
                      {ev.end && ev.end !== ev.start ? ` — ${ev.end}` : ""}
                    </div>
                    <div style={{ marginTop:6 }}>
                      <div style={{ height:8, background:'#e6eef8', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ width: `${(ev.extendedProps.progress||0)}%`, height:'100%', background:'#2563eb' }} />
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>{ev.extendedProps.progress || 0}% complete</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button className="btn-ghost" onClick={() => openEdit(ev)}>Edit</button>
                    <button className="btn-ghost" onClick={() => handleToggleComplete(ev.id, ev.extendedProps.completed)}>{ev.extendedProps.completed ? '✅ Done' : '🕐 Pending'}</button>
                    <button className="btn-ghost" onClick={() => handleDelete(ev.id)}>Delete</button>
                  </div>
                </div>
              ))
          )}
        </div>
      </aside>

      <main className="timeline-main">
        <h2 className="sr-only">Calendar</h2>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" }}
          editable={true}
          selectable={true}
          eventDrop={onEventDrop}
          events={events}
          eventClick={(info) => {
            // open editor on event click
            openEdit({
              id: info.event.id,
              title: info.event.title,
              start: info.event.startStr,
              end: info.event.endStr,
              extendedProps: info.event.extendedProps,
            });
          }}
          height="auto"
        />
      </main>
      {/* modal */}
      {modalOpen && selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Edit Milestone</h3>
            <form onSubmit={handleSaveEdit} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <input value={selected.title} onChange={(e)=>setSelected({...selected, title:e.target.value})} />
              <textarea placeholder="Description" value={selected.extendedProps.description} onChange={(e)=>setSelected({...selected, extendedProps:{...selected.extendedProps, description:e.target.value}})} />
              <div style={{ display:'flex', gap:8 }}>
                <input type="date" value={selected.start || ''} onChange={(e)=>setSelected({...selected, start:e.target.value})} />
                <input type="date" value={selected.end || ''} onChange={(e)=>setSelected({...selected, end:e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select value={selected.extendedProps.priority} onChange={(e)=>setSelected({...selected, extendedProps:{...selected.extendedProps, priority:e.target.value}})}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <label style={{ display:'flex', gap:6, alignItems:'center' }}><input type="checkbox" checked={selected.extendedProps.completed} onChange={(e)=>setSelected({...selected, extendedProps:{...selected.extendedProps, completed:e.target.checked}})} /> Completed</label>
                <input type="number" min={0} max={100} value={selected.extendedProps.progress} onChange={(e)=>setSelected({...selected, extendedProps:{...selected.extendedProps, progress: Number(e.target.value)}})} style={{ width:80 }} />
              </div>
              <textarea placeholder="Notes" value={selected.extendedProps.notes} onChange={(e)=>setSelected({...selected, extendedProps:{...selected.extendedProps, notes:e.target.value}})} />
              <div>
                <label>Subtasks</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap:6, marginTop:6 }}>
                  {(selected.extendedProps.subtasks || []).map((s, idx) => (
                    <div key={idx} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input type="checkbox" checked={s.done} onChange={(e)=>{
                        const copy = {...selected};
                        copy.extendedProps = {...copy.extendedProps};
                        copy.extendedProps.subtasks = (copy.extendedProps.subtasks||[]).map((st,i)=> i===idx?{...st, done:e.target.checked}:st);
                        setSelected(copy);
                      }} />
                      <div style={{ flex:1 }}>{s.title}</div>
                      <button type="button" onClick={() => {
                        const copy = {...selected};
                        copy.extendedProps = {...copy.extendedProps};
                        copy.extendedProps.subtasks = (copy.extendedProps.subtasks||[]).filter((_,i)=>i!==idx);
                        setSelected(copy);
                      }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:8 }}>
                    <input placeholder="New subtask" value={newSubtaskText} onChange={(e)=>setNewSubtaskText(e.target.value)} />
                    <button type="button" onClick={() => {
                      if (!newSubtaskText) return;
                      const copy = {...selected};
                      copy.extendedProps = {...copy.extendedProps};
                      copy.extendedProps.subtasks = (copy.extendedProps.subtasks||[]).concat({ title: newSubtaskText, done: false });
                      setSelected(copy);
                      setNewSubtaskText("");
                    }}>Add</button>
                  </div>
                </div>
              </div>
              <div>
                <label>Attachments</label>
                <input ref={fileInputRef} type="file" multiple />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" onClick={closeModal}>Cancel</button>
                <button className="btn-primary" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* notifications */}
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map(n => (
            <div key={n.id} className="notification">{n.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
