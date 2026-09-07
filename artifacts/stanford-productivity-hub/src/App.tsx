import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Dumbbell, Flag, Home, LayoutList, Leaf, ListChecks, Moon, MoreHorizontal, Pencil, Plus, Rocket, Sparkles, Sun, Trash2, X } from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const iso = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const today = () => iso(new Date());
const plusDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
const formatLongDate = (date = new Date()) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
const formatShortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Task = { id: string; title: string; dueDate: string; category: string; priority: 'low' | 'medium' | 'high'; completed: boolean; estimatedMinutes: number };
type EventItem = { id: string; title: string; date: string; startTime: string; endTime: string; category: string };
type CalendarItem = { id: string; title: string; category: string; isTask: boolean; startTime: string; endTime: string };
type Habit = { id: string; name: string; color: string; targetPerWeek: number; completions: Record<string, boolean> };
type Settings = { focus: string; name: string };

const defaultData = () => {
  const t = today();
  const completions: Record<string, boolean> = {};
  for (let i = 1; i <= 5; i += 1) completions[plusDays(-i)] = i < 4;
  return {
    tasks: [
      { id: 't1', title: 'Review linear algebra notes', dueDate: t, category: 'Academics', priority: 'high', completed: false, estimatedMinutes: 45 },
      { id: 't2', title: 'Draft introduction for history seminar', dueDate: t, category: 'Academics', priority: 'medium', completed: false, estimatedMinutes: 35 },
      { id: 't3', title: 'Email Maya about study group', dueDate: t, category: 'Life admin', priority: 'low', completed: true, estimatedMinutes: 10 },
      { id: 't4', title: 'Read chapter 4 of The Dispossessed', dueDate: plusDays(1), category: 'Personal', priority: 'medium', completed: false, estimatedMinutes: 40 },
      { id: 't5', title: 'Outline week 3 problem set', dueDate: plusDays(2), category: 'Academics', priority: 'high', completed: false, estimatedMinutes: 60 },
      { id: 't6', title: 'Pick up film for Saturday', dueDate: plusDays(4), category: 'Personal', priority: 'low', completed: false, estimatedMinutes: 15 },
    ] as Task[],
    events: [
      { id: 'e1', title: 'Designing Your Stanford', date: t, startTime: '09:00', endTime: '10:30', category: 'Campus' },
      { id: 'e2', title: 'Lunch with Priya', date: t, startTime: '12:30', endTime: '13:30', category: 'Personal' },
      { id: 'e3', title: 'Calculus discussion', date: t, startTime: '15:00', endTime: '16:00', category: 'Academics' },
      { id: 'e4', title: 'Piano practice', date: plusDays(1), startTime: '18:00', endTime: '18:45', category: 'Personal' },
      { id: 'e5', title: 'Open studio hours', date: plusDays(3), startTime: '14:00', endTime: '16:00', category: 'Campus' },
    ] as EventItem[],
    habits: [
      { id: 'h1', name: 'Morning pages', color: '#D47965', targetPerWeek: 5, completions: { ...completions, [t]: true } },
      { id: 'h2', name: 'Move for 20 minutes', color: '#7A9A80', targetPerWeek: 4, completions: { ...completions, [t]: false } },
      { id: 'h3', name: 'Lights out by 11:30', color: '#C6A15B', targetPerWeek: 6, completions: { ...completions, [t]: true } },
    ] as Habit[],
    settings: { focus: 'Make room for one good, unhurried thought.', name: 'Alex' } as Settings,
  };
};

function useLocalStore<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function AppShell({ children, settings, onToggleTheme }: { children: ReactNode; settings: Settings; onToggleTheme: () => void }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Today', icon: Home },
    { href: '/calendar', label: 'Calendar', icon: LayoutList },
    { href: '/tasks', label: 'Tasks', icon: ListChecks },
    { href: '/habits', label: 'Habits', icon: Leaf },
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-brand">
        <span className="brand-mark">S</span>
        <span><span className="brand-name">Stanford<br />Productivity Hub</span><span className="brand-sub">a quieter way forward</span></span>
      </Link>
      <div className="sidebar-label">Your desk</div>
      <nav aria-label="Primary navigation">
        {nav.map(item => <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase()}`}><item.icon /><span>{item.label}</span></Link>)}
      </nav>
      <div className="sidebar-label">Perspective</div>
      <Link href="/roadmap" className={`nav-link ${location === '/roadmap' ? 'active' : ''}`} data-testid="link-nav-roadmap"><Rocket /><span>Roadmap</span></Link>
      <div className="side-note">
        <p>Ambition has a rhythm.</p>
        <span>Plan enough to move with purpose. Leave enough room to notice your life.</span>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-date" data-testid="text-current-date">{formatLongDate()}</div>
        <div className="topbar-actions">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu" aria-label="Open navigation"><MoreHorizontal size={16} /></button>
          <button className="icon-button" onClick={onToggleTheme} data-testid="button-toggle-theme" aria-label="Toggle theme"><Moon size={15} /></button>
          <button className="icon-button" onClick={() => setHelpOpen(!helpOpen)} data-testid="button-help" aria-label="Help"><CircleHelp size={16} /></button>
          <span className="avatar" data-testid="avatar-user">{settings.name.slice(0, 2).toUpperCase()}</span>
        </div>
      </header>
      {menuOpen && <div className="mobile-nav" data-testid="menu-mobile-nav">{nav.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="nav-link" data-testid={`link-mobile-${item.label.toLowerCase()}`}><item.icon /><span>{item.label}</span></Link>)}<Link href="/roadmap" onClick={() => setMenuOpen(false)} className="nav-link" data-testid="link-mobile-roadmap"><Rocket /><span>Roadmap</span></Link></div>}
      {helpOpen && <div className="help-popover" data-testid="popover-help"><strong>A calm place to start</strong><span>Use Today for the shape of your day. Calendar holds the fixed points; Tasks holds the next steps.</span><button className="button-quiet" onClick={() => setHelpOpen(false)} data-testid="button-close-help">Got it</button></div>}
      {children}
    </main>
  </div>;
}

function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-title"><h2>{title}</h2>{action || <span>{detail}</span>}</div>;
}

function TaskCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return <button className={`task-check ${task.completed ? 'done' : ''}`} onClick={onToggle} data-testid={`button-complete-task-${task.id}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.completed && <Check size={12} strokeWidth={3} />}</button>;
}

function TodayPage({ tasks, events, habits, settings, setTasks, setHabits, setSettings, notify, openTask }: {
  tasks: Task[]; events: EventItem[]; habits: Habit[]; settings: Settings; setTasks: (v: Task[]) => void; setHabits: (v: Habit[]) => void; setSettings: (v: Settings) => void; notify: (v: string) => void; openTask: () => void;
}) {
  const due = tasks.filter(t => t.dueDate === today()).sort((a, b) => Number(a.completed) - Number(b.completed));
  const todaysEvents = events.filter(e => e.date === today()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const toggleTask = (id: string) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const toggleHabit = (id: string) => { setHabits(habits.map(h => h.id === id ? { ...h, completions: { ...h.completions, [today()]: !h.completions[today()] } } : h)); notify('A small promise kept.'); };
  return <div className="content">
    <div className="page-heading">
      <div className="heading-copy"><div className="eyebrow">Tuesday, September 16 · Week 2</div><h1 className="display-title">Good morning, {settings.name}.</h1><p>A clear place to begin. Here’s the shape of your day — ambitious, but with breathing room.</p></div>
      <button className="button-primary" onClick={openTask} data-testid="button-add-task-today"><Plus size={15} /> Add a task</button>
    </div>
    <div className="today-grid">
      <div className="left-stack">
        <section className="card focus-card">
          <div className="eyebrow">Your daily focus</div>
          <h2>One clear intention is enough to change the texture of a day.</h2>
          <input className="focus-input" value={settings.focus} onChange={e => setSettings({ ...settings, focus: e.target.value })} data-testid="input-daily-focus" aria-label="Daily focus" />
          <div className="focus-footer"><span>Saved locally</span><span><Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />make it yours</span></div>
        </section>
        <section className="card card-pad">
          <SectionTitle title="Today's tasks" detail={`${due.filter(t => t.completed).length} of ${due.length} complete`} />
          <div className="task-list">
            {due.length ? due.map(task => <div className="task-row" key={task.id}><TaskCheck task={task} onToggle={() => toggleTask(task.id)} /><span className={`task-name ${task.completed ? 'done' : ''}`} data-testid={`text-task-${task.id}`}>{task.title}</span><div className="task-meta"><span className={`priority-dot ${task.priority}`} /><span className="tag">{task.category}</span><span className="time-label">{task.estimatedMinutes}m</span></div></div>) : <div className="empty-state"><Check size={22} /><p>The day is open.</p><span>Add what would make today feel meaningful.</span></div>}
          </div>
        </section>
        <section className="card card-pad">
          <SectionTitle title="Your habits" action={<Link href="/habits" className="button-quiet" data-testid="link-see-habits">See all <ChevronRight size={13} /></Link>} />
          <div className="habit-strip">
            {habits.slice(0, 3).map(h => <button className={`habit-mini ${h.completions[today()] ? 'checked' : ''}`} key={h.id} onClick={() => toggleHabit(h.id)} data-testid={`button-toggle-habit-${h.id}`}><span className="habit-mini-top"><span className="habit-color" style={{ background: h.color }} />{h.completions[today()] && <Check size={14} />}</span><strong>{h.name}</strong><span>{h.completions[today()] ? 'Checked in' : 'Not yet today'}</span></button>)}
          </div>
        </section>
      </div>
      <div className="right-stack">
        <section className="card card-pad">
          <SectionTitle title="On the horizon" detail="Today" />
          {todaysEvents.length ? todaysEvents.map(event => <div className="schedule-item" key={event.id}><span className="schedule-time">{event.startTime}</span><span className="schedule-dot" /><span className="schedule-line" /><div className="schedule-info"><strong data-testid={`text-event-${event.id}`}>{event.title}</strong><span>{event.startTime} — {event.endTime} · {event.category}</span></div></div>) : <div className="empty-state"><p>No plans on the horizon.</p><span>A gentle blank space.</span></div>}
        </section>
        <section className="card card-pad">
          <SectionTitle title="Workload signal" detail="A gentle read" />
          <div className="signal"><div className="signal-ring"><b>64%</b></div><div className="signal-copy"><strong>Steady, with space</strong><span>You have about 2h 10m of focused work today. Consider protecting an hour for wandering.</span></div></div>
        </section>
        <section className="card card-pad">
          <SectionTitle title="A note for today" />
          <p style={{ fontFamily: 'var(--app-font-serif)', fontSize: 20, lineHeight: 1.18, margin: 0, color: 'hsl(var(--primary))' }}>“The important thing is not to stop questioning.”</p>
          <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', margin: '11px 0 0', fontFamily: 'var(--app-font-mono)' }}>— ALBERT EINSTEIN</p>
        </section>
      </div>
    </div>
  </div>;
}

function EventModal({ event, initialDate, onSave, onClose }: { event?: EventItem; initialDate?: string; onSave: (event: EventItem) => void; onClose: () => void }) {
  const [form, setForm] = useState<EventItem>(event || { id: uid(), title: '', date: initialDate || today(), startTime: '09:00', endTime: '10:00', category: 'Campus' });
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><h2>{event ? 'Edit event' : 'Make a little room'}</h2><p>Add a fixed point to your week.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-event"><X size={16} /></button></div>
    <div className="form-grid">
      <div className="field full"><label htmlFor="event-title">Title</label><input id="event-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-event-title" placeholder="e.g. Walk around the Oval" /></div>
      <div className="field"><label htmlFor="event-date">Date</label><input id="event-date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-event-date" /></div>
      <div className="field"><label htmlFor="event-category">Category</label><select id="event-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-event-category"><option>Campus</option><option>Academics</option><option>Personal</option><option>Work</option></select></div>
      <div className="field"><label htmlFor="event-start">Starts</label><input id="event-start" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} data-testid="input-event-start" /></div>
      <div className="field"><label htmlFor="event-end">Ends</label><input id="event-end" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} data-testid="input-event-end" /></div>
    </div>
    <div className="modal-footer"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-event">Cancel</button><button className="button-primary" disabled={!form.title.trim()} onClick={() => { onSave({ ...form, title: form.title.trim() }); onClose(); }} data-testid="button-save-event">Save event</button></div>
  </div></div>;
}

function CalendarPage({ tasks, events, setEvents, notify }: { tasks: Task[]; events: EventItem[]; setEvents: (v: EventItem[]) => void; notify: (v: string) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [modal, setModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today());
  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const first = new Date(year, month, 1); const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const move = (amount: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + (view === 'month' ? amount : 0), d.getDate() + (view === 'week' ? amount * 7 : 0)); setCursor(d); };
  const dayItems = (day: Date): CalendarItem[] => {
    const date = iso(day);
    return [
      ...events.filter(e => e.date === date).map(e => ({ ...e, isTask: false })),
      ...tasks.filter(t => t.dueDate === date).map(t => ({ id: t.id, title: t.title, category: t.category, isTask: true, startTime: '', endTime: '' })),
    ];
  };
  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const selectedItems = dayItems(selectedDay).sort((a, b) => {
    if (a.isTask !== b.isTask) return a.isTask ? 1 : -1;
    return a.startTime.localeCompare(b.startTime);
  });
  const selectDay = (day: Date) => setSelectedDate(iso(day));
  const saveEvent = (event: EventItem) => {
    setEvents(events.some(e => e.id === event.id) ? events.map(e => e.id === event.id ? event : e) : [...events, event]);
    setSelectedDate(event.date);
    setCursor(new Date(`${event.date}T12:00:00`));
    notify('Event added to your week.');
  };
  return <div className="content">
    <div className="page-heading"><div className="heading-copy"><div className="eyebrow">A wider view</div><h1 className="display-title">Calendar</h1><p>See the shape of your time before it fills up. Tasks and events share the same quiet table.</p></div><button className="button-primary" onClick={() => setModal(true)} data-testid="button-add-event"><Plus size={15} /> Add event</button></div>
    <div className="card card-pad">
      <div className="calendar-toolbar"><button className="icon-button" onClick={() => move(-1)} data-testid="button-calendar-prev"><ChevronLeft size={15} /></button><button className="icon-button" onClick={() => { setCursor(new Date()); }} data-testid="button-calendar-today"><Sun size={14} /></button><button className="icon-button" onClick={() => move(1)} data-testid="button-calendar-next"><ChevronRight size={15} /></button><h2>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursor)}</h2><div className="calendar-view-toggle"><button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')} data-testid="button-calendar-month">Month</button><button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')} data-testid="button-calendar-week">Week</button></div></div>
      {view === 'month' ? <div className="calendar-wrap"><div className="calendar-grid" style={{ marginTop: 20 }}><>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-head" key={day}>{day}</div>)}{cells.map(day => { const date = iso(day); const items = dayItems(day); return <button type="button" className={`calendar-cell ${day.getMonth() !== month ? 'muted-day' : ''} ${date === today() ? 'today' : ''} ${date === selectedDate ? 'selected-day' : ''}`} onClick={() => selectDay(day)} aria-label={`View ${formatLongDate(day)}`} key={date} data-testid={`button-calendar-day-${date}`}><div className="day-number">{day.getDate()}</div>{items.slice(0, 3).map(item => <div className={`calendar-event ${item.isTask ? 'task-event' : ''}`} title={item.title} key={`${item.id}-${item.isTask}`}>{item.title}</div>)}{items.length > 3 && <div className="calendar-more">+{items.length - 3} more</div>}</button>; })}</></div></div> : <div className="week-grid-wrap" style={{ marginTop: 20 }}><WeekView cursor={cursor} dayItems={dayItems} selectedDate={selectedDate} onSelectDay={selectDay} /></div>}
      <section className="selected-day-panel" aria-live="polite" data-testid="selected-day-panel">
        <div className="selected-day-header"><div><div className="eyebrow">Selected day</div><h3>{formatLongDate(selectedDay)}</h3></div><button className="button-secondary" onClick={() => setModal(true)} data-testid="button-add-event-selected-day"><Plus size={14} /> Add event for this day</button></div>
        {selectedItems.length ? <div className="selected-day-timeline">{selectedItems.map(item => <div className={`selected-day-item ${item.isTask ? 'selected-day-task' : ''}`} key={`${item.id}-${item.isTask}`} data-testid={`row-calendar-item-${item.id}`}><span className="selected-day-time">{item.isTask ? 'Task' : `${item.startTime} — ${item.endTime}`}</span><span className="schedule-dot" /><div><strong>{item.title}</strong><span>{item.category}{item.isTask ? ' · Due today' : ''}</span></div></div>)}</div> : <div className="selected-day-empty"><p>No plans yet.</p><span>Choose a day and give it a shape that feels possible.</span></div>}
      </section>
    </div>
    {modal && <EventModal initialDate={selectedDate} onSave={saveEvent} onClose={() => setModal(false)} />}
  </div>;
}

function WeekView({ cursor, dayItems, selectedDate, onSelectDay }: { cursor: Date; dayItems: (d: Date) => CalendarItem[]; selectedDate: string; onSelectDay: (day: Date) => void }) {
  const weekStart = new Date(cursor); weekStart.setDate(cursor.getDate() - cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const times = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  return <div className="week-grid"><div className="week-time" />{days.map(d => { const date = iso(d); return <button type="button" className={`week-time week-day-button ${date === selectedDate ? 'selected-week-day' : ''}`} onClick={() => onSelectDay(d)} key={date} style={{ color: date === today() ? 'hsl(var(--accent))' : undefined }} data-testid={`button-calendar-week-day-${date}`}>{new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(d)}</button>; })}{times.map(time => <div className="contents" key={time}><div className="week-time">{time}</div>{days.map(day => <button type="button" className={`week-cell ${iso(day) === selectedDate ? 'selected-week-cell' : ''}`} onClick={() => onSelectDay(day)} key={`${time}-${iso(day)}`} aria-label={`View ${formatLongDate(day)} around ${time}`} data-testid={`button-calendar-week-cell-${iso(day)}-${time}`}>{time === '08:00' && dayItems(day).slice(0, 2).map(item => <div className="week-event" key={`${item.id}-${item.isTask}`}>{item.title}</div>)}</button>)}</div>)}</div>;
}

function TaskModal({ task, onSave, onClose }: { task?: Task; onSave: (task: Task) => void; onClose: () => void }) {
  const [form, setForm] = useState<Task>(task || { id: uid(), title: '', dueDate: today(), category: 'Academics', priority: 'medium', completed: false, estimatedMinutes: 30 });
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><h2>{task ? 'Refine the task' : 'Add a task'}</h2><p>Keep the next step concrete and kind.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-task"><X size={16} /></button></div>
    <div className="form-grid"><div className="field full"><label htmlFor="task-title">Task</label><input id="task-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-task-title" placeholder="What would feel good to finish?" /></div><div className="field"><label htmlFor="task-date">Due date</label><input id="task-date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} data-testid="input-task-due-date" /></div><div className="field"><label htmlFor="task-category">Category</label><select id="task-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-task-category"><option>Academics</option><option>Life admin</option><option>Personal</option><option>Campus</option></select></div><div className="field"><label htmlFor="task-priority">Priority</label><select id="task-priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })} data-testid="select-task-priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div className="field"><label htmlFor="task-time">Estimate (minutes)</label><input id="task-time" type="number" min="5" step="5" value={form.estimatedMinutes} onChange={e => setForm({ ...form, estimatedMinutes: Number(e.target.value) })} data-testid="input-task-estimate" /></div></div>
    <div className="modal-footer"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-task">Cancel</button><button className="button-primary" disabled={!form.title.trim()} onClick={() => { onSave({ ...form, title: form.title.trim() }); onClose(); }} data-testid="button-save-task">Save task</button></div>
  </div></div>;
}

function TasksPage({ tasks, setTasks, notify }: { tasks: Task[]; setTasks: (v: Task[]) => void; notify: (v: string) => void }) {
  const [filter, setFilter] = useState('All'); const [modal, setModal] = useState<Task | 'new' | null>(null);
  const categories = ['All', 'Academics', 'Personal', 'Life admin', 'Campus'];
  const filtered = tasks.filter(t => filter === 'All' || t.category === filter).sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate));
  const save = (task: Task) => { setTasks(tasks.some(t => t.id === task.id) ? tasks.map(t => t.id === task.id ? task : t) : [task, ...tasks]); notify('Task saved.'); };
  const toggle = (id: string) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const remove = (id: string) => { if (window.confirm('Delete this task?')) { setTasks(tasks.filter(t => t.id !== id)); notify('Task cleared.'); } };
  return <div className="content"><div className="page-heading"><div className="heading-copy"><div className="eyebrow">The inbox</div><h1 className="display-title">Tasks</h1><p>Everything you want to carry, in one considered place. Sort the noise; keep the signal.</p></div><button className="button-primary" onClick={() => setModal('new')} data-testid="button-add-task"><Plus size={15} /> New task</button></div>
    <div className="filter-row">{categories.map(category => <button className={`filter-chip ${filter === category ? 'active' : ''}`} onClick={() => setFilter(category)} key={category} data-testid={`button-filter-${category.toLowerCase().replace(' ', '-')}`}>{category}</button>)}<span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', font: '10px var(--app-font-mono)' }}>{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</span></div>
    <div className="task-inbox"><section className="card">{filtered.length ? filtered.map(task => <div className="inbox-row" key={task.id}><TaskCheck task={task} onToggle={() => toggle(task.id)} /><div><div className={`inbox-title ${task.completed ? 'task-name done' : ''}`} data-testid={`text-inbox-task-${task.id}`}>{task.title}</div><div className="inbox-details"><span>{task.dueDate === today() ? 'Today' : formatShortDate(task.dueDate)}</span><span className="tag">{task.category}</span><span><Clock3 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{task.estimatedMinutes} min</span></div></div><div className="row-actions"><button className="button-quiet" onClick={() => setModal(task)} data-testid={`button-edit-task-${task.id}`} aria-label={`Edit ${task.title}`}><Pencil size={14} /></button><button className="button-quiet" onClick={() => remove(task.id)} data-testid={`button-delete-task-${task.id}`} aria-label={`Delete ${task.title}`}><Trash2 size={14} /></button></div></div>) : <div className="empty-state" style={{ padding: '60px 20px' }}><Flag size={24} /><p>Nothing is asking for you.</p><span>Try a different filter or start with one small next step.</span></div>}</section>
      <aside className="card card-pad"><SectionTitle title="A softer metric" /><div className="stat-box" style={{ marginBottom: 10 }}><b>{tasks.filter(t => t.completed).length}</b><span>tasks completed</span></div><div className="stat-box"><b>{Math.round(tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60 * 10) / 10}h</b><span>open focus time</span></div><p style={{ fontFamily: 'var(--app-font-serif)', fontSize: 18, lineHeight: 1.25, color: 'hsl(var(--primary))' }}>Progress is not a personality test.</p></aside></div>
    {modal && <TaskModal task={modal === 'new' ? undefined : modal} onSave={save} onClose={() => setModal(null)} />}
  </div>;
}

function HabitModal({ habit, onSave, onClose }: { habit?: Habit; onSave: (habit: Habit) => void; onClose: () => void }) {
  const [form, setForm] = useState<Habit>(habit || { id: uid(), name: '', color: '#D47965', targetPerWeek: 4, completions: {} });
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><h2>{habit ? 'Shape the habit' : 'A small practice'}</h2><p>Habits work best when they are easy to return to.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-habit"><X size={16} /></button></div><div className="form-grid"><div className="field full"><label htmlFor="habit-name">Practice</label><input id="habit-name" autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-habit-name" placeholder="e.g. Read before bed" /></div><div className="field"><label htmlFor="habit-target">Days each week</label><input id="habit-target" type="number" min="1" max="7" value={form.targetPerWeek} onChange={e => setForm({ ...form, targetPerWeek: Number(e.target.value) })} data-testid="input-habit-target" /></div><div className="field"><label htmlFor="habit-color">Accent color</label><input id="habit-color" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} data-testid="input-habit-color" /></div></div><div className="modal-footer"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-habit">Cancel</button><button className="button-primary" disabled={!form.name.trim()} onClick={() => { onSave({ ...form, name: form.name.trim() }); onClose(); }} data-testid="button-save-habit">Save practice</button></div></div></div>;
}

function HabitsPage({ habits, setHabits, notify }: { habits: Habit[]; setHabits: (v: Habit[]) => void; notify: (v: string) => void }) {
  const [modal, setModal] = useState<Habit | 'new' | null>(null);
  const save = (habit: Habit) => { setHabits(habits.some(h => h.id === habit.id) ? habits.map(h => h.id === habit.id ? habit : h) : [...habits, habit]); notify('Practice saved.'); };
  const toggle = (id: string, date = today()) => { setHabits(habits.map(h => h.id === id ? { ...h, completions: { ...h.completions, [date]: !h.completions[date] } } : h)); };
  const last7 = Array.from({ length: 7 }, (_, i) => plusDays(-6 + i));
  return <div className="content"><div className="page-heading"><div className="heading-copy"><div className="eyebrow">Small things, repeated</div><h1 className="display-title">Habits</h1><p>Build a week you can actually live inside. Check in without keeping score of your worth.</p></div><button className="button-primary" onClick={() => setModal('new')} data-testid="button-add-habit"><Plus size={15} /> New habit</button></div>
    <div className="habits-layout"><section className="card"><SectionTitle title="This week" detail={`${habits.length} active practices`} />{habits.length ? habits.map(h => { const count = last7.filter(d => h.completions[d]).length; return <div className="habit-card" key={h.id}><span className="habit-card-color" style={{ background: h.color }} /><div><h3 data-testid={`text-habit-${h.id}`}>{h.name}</h3><p>{count} of {h.targetPerWeek} days · {count >= h.targetPerWeek ? 'You made your aim.' : `${h.targetPerWeek - count} more to reach your aim.`}</p><div className="week-dots">{last7.map((d, i) => <button className={`week-dot ${h.completions[d] ? 'filled' : ''}`} onClick={() => toggle(h.id, d)} key={d} title={d} data-testid={`button-habit-${h.id}-${i}`}>{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))}</button>)}</div></div><div style={{ display: 'flex', gap: 2, alignItems: 'center' }}><button className={`habit-check ${h.completions[today()] ? 'checked' : ''}`} onClick={() => toggle(h.id)} data-testid={`button-check-habit-${h.id}`} aria-label={`Check in ${h.name}`}>{h.completions[today()] && <Check size={17} />}</button><button className="button-quiet" onClick={() => setModal(h)} data-testid={`button-edit-habit-${h.id}`} aria-label={`Edit ${h.name}`}><Pencil size={14} /></button></div></div>; }) : <div className="empty-state" style={{ padding: 60 }}><Leaf size={24} /><p>Start with something sustainable.</p><span>A habit can be as small as five minutes.</span></div>}</section>
      <aside className="card card-pad"><SectionTitle title="Your rhythm" /><div className="stat-grid"><div className="stat-box"><b>{habits.reduce((n, h) => n + last7.filter(d => h.completions[d]).length, 0)}</b><span>check-ins</span></div><div className="stat-box"><b>{habits.length ? Math.round(habits.reduce((n, h) => n + last7.filter(d => h.completions[d]).length / 7, 0) / habits.length * 100) : 0}%</b><span>consistency</span></div><div className="stat-box"><b>{habits.filter(h => h.completions[today()]).length}</b><span>today</span></div></div><div style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 22, paddingTop: 20 }}><p style={{ fontFamily: 'var(--app-font-serif)', fontSize: 21, lineHeight: 1.2, margin: 0, color: 'hsl(var(--primary))' }}>A gentle return is still a return.</p><p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, lineHeight: 1.5 }}>The point is not a perfect streak. It is learning what helps you feel like yourself.</p></div></aside></div>
    {modal && <HabitModal habit={modal === 'new' ? undefined : modal} onSave={save} onClose={() => setModal(null)} />}
  </div>;
}

function RoadmapPage() {
  const steps = [
    { phase: 'Now · MVP', title: 'A trusted daily desk', copy: 'Today, tasks, calendar, and habits live together without shouting. Everything is local, personal, and quick to adjust when the day changes.', icon: Check, current: true, pill: 'You are here' },
    { phase: 'Next chapter', title: 'Less copying, more context', copy: 'Canvas and syllabus import will turn course materials into a considered starting point: key dates, reading arcs, and the tasks between them.', icon: LayoutList, pill: 'Canvas + syllabus import' },
    { phase: 'A wider lens', title: 'Protect the attention underneath', copy: 'Screen-time insights will make the invisible visible — not as a score, but as a gentle prompt to notice which rhythms help you do your best work.', icon: Moon, pill: 'Screen-time insights' },
    { phase: 'With you, anywhere', title: 'The desk in your pocket', copy: 'A mobile companion for hallway thoughts, habit check-ins, and the quiet five-minute planning ritual before a new day begins.', icon: Dumbbell, pill: 'Mobile companion' },
    { phase: 'Eventually', title: 'Planning that learns your pace', copy: 'Smarter planning will suggest a shape for the week based on your energy, commitments, and patterns — always with your edit as the final word.', icon: Sparkles, pill: 'Adaptive planning' },
  ];
  return <div className="content"><div className="roadmap"><div className="eyebrow">A living direction</div><h1 className="display-title">Roadmap</h1><p className="roadmap-intro">Stanford is a lot of things at once: a demanding course, a new neighborhood, a community still becoming familiar. This product should help you hold all of it with a little more intention.</p>{steps.map((step, i) => <div className={`roadmap-item ${step.current ? 'current' : ''}`} key={step.title}><div className="roadmap-phase">{step.phase}</div><div className="roadmap-node"><step.icon size={13} /></div><div className="roadmap-copy"><h3>{step.title}</h3><p>{step.copy}</p><span className="roadmap-pill">{step.pill}</span></div></div>)}</div></div>;
}

function Router({ tasks, events, habits, settings, setTasks, setEvents, setHabits, setSettings, notify, openTask }: {
  tasks: Task[]; events: EventItem[]; habits: Habit[]; settings: Settings; setTasks: (v: Task[]) => void; setEvents: (v: EventItem[]) => void; setHabits: (v: Habit[]) => void; setSettings: (v: Settings) => void; notify: (v: string) => void; openTask: () => void;
}) {
  return <Switch><Route path="/"><TodayPage tasks={tasks} events={events} habits={habits} settings={settings} setTasks={setTasks} setHabits={setHabits} setSettings={setSettings} notify={notify} openTask={openTask} /></Route><Route path="/calendar"><CalendarPage tasks={tasks} events={events} setEvents={setEvents} notify={notify} /></Route><Route path="/tasks"><TasksPage tasks={tasks} setTasks={setTasks} notify={notify} /></Route><Route path="/habits"><HabitsPage habits={habits} setHabits={setHabits} notify={notify} /></Route><Route path="/roadmap"><RoadmapPage /></Route><Route component={NotFound} /></Switch>;
}

function App() {
  const seed = useMemo(() => defaultData(), []);
  const [tasks, setTasks] = useLocalStore<Task[]>('stanford-hub-tasks', seed.tasks);
  const [events, setEvents] = useLocalStore<EventItem[]>('stanford-hub-events', seed.events);
  const [habits, setHabits] = useLocalStore<Habit[]>('stanford-hub-habits', seed.habits);
  const [settings, setSettings] = useLocalStore<Settings>('stanford-hub-settings', seed.settings);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [location, setLocation] = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const openTask = () => { if (location !== '/tasks') setLocation('/tasks'); };
  return <QueryClientProvider client={queryClient}><TooltipProvider><AppShell settings={settings} onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}><ErrorBoundary resetKey={location}><Router tasks={tasks} events={events} habits={habits} settings={settings} setTasks={setTasks} setEvents={setEvents} setHabits={setHabits} setSettings={setSettings} notify={notify} openTask={openTask} /></ErrorBoundary></AppShell>{toast && <div className="toast" data-testid="status-toast">{toast}</div>}<Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;