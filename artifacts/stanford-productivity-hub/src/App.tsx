import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Dumbbell, Flag, Home, LayoutList, Leaf, ListChecks, Mic, Moon, MoreHorizontal, Pencil, Plus, Rocket, Sparkles, Square, Sun, Trash2, X } from 'lucide-react';
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

type Task = { id: string; title: string; description?: string; dueDate: string; category: string; priority: 'low' | 'medium' | 'high'; completed: boolean; estimatedMinutes: number; recurrence?: string };
type EventItem = { id: string; title: string; description?: string; date: string; startTime: string; endTime: string; category: string; recurrence?: string };
type CalendarItem = { id: string; title: string; description?: string; category: string; isTask: boolean; startTime: string; endTime: string };
type Habit = { id: string; name: string; color: string; targetPerWeek: number; completions: Record<string, boolean> };
type Settings = { focus: string; name: string; voiceConfirmation?: boolean };
type Category = { id: string; name: string; color: string };
type VoiceDraft = { kind: 'event' | 'task'; title: string; date: string; startTime: string; endTime: string; category: string; recurrence: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const categoryPalettes = {
  pastel: ['#E9B8B5', '#F2C59C', '#F2D68A', '#B9D5B2', '#A9D6D6', '#B7C7E5', '#D0B9E2', '#E4B8D0'],
  stanford: ['#D47965', '#C85D4F', '#C6A15B', '#E0A46B', '#7A9A80', '#6E879F', '#8A739B', '#243F63'],
};

const defaultCategories: Category[] = [
  { id: 'campus', name: 'Campus', color: '#D47965' },
  { id: 'academics', name: 'Academics', color: '#6E879F' },
  { id: 'personal', name: 'Personal', color: '#7A9A80' },
  { id: 'work', name: 'Work', color: '#C6A15B' },
  { id: 'life-admin', name: 'Life admin', color: '#8A739B' },
];

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
    categories: defaultCategories,
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

function CategoryColorPicker({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState<'pastel' | 'stanford'>('pastel');
  return <div className="color-picker">
    <button type="button" className={`color-select-trigger ${compact ? 'compact-color-trigger' : ''}`} onClick={e => { e.stopPropagation(); setOpen(!open); }} aria-expanded={open} aria-label="Choose category color" data-testid="button-category-color"><span className="color-swatch" style={{ background: value }} />{!compact && <>{value.toUpperCase()}<ChevronRight size={13} className={open ? 'color-picker-chevron open' : 'color-picker-chevron'} /></>}</button>
    {open && <div className="color-palette-popover">
      <div className="palette-tabs"><button type="button" className={palette === 'pastel' ? 'active' : ''} onClick={() => setPalette('pastel')}>Pastels</button><button type="button" className={palette === 'stanford' ? 'active' : ''} onClick={() => setPalette('stanford')}>Stanford</button></div>
      <div className="palette-grid">{categoryPalettes[palette].map(color => <button type="button" className={`palette-swatch ${color === value ? 'selected' : ''}`} key={color} style={{ background: color }} onClick={() => { onChange(color); setOpen(false); }} aria-label={`Choose ${color}`} />)}</div>
    </div>}
  </div>;
}

function CategoryManager({ categories, onChange, onClose }: { categories: Category[]; onChange: (categories: Category[]) => void; onClose: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(categoryPalettes.pastel[0]);
  const reset = () => { setEditingId(null); setDraftName(''); setDraftColor(categoryPalettes.pastel[0]); };
  const beginEdit = (category: Category) => { setEditingId(category.id); setDraftName(category.name); setDraftColor(category.color); };
  const save = () => {
    const name = draftName.trim();
    if (!name || categories.some(category => category.name.toLowerCase() === name.toLowerCase() && category.id !== editingId)) return;
    if (editingId) onChange(categories.map(category => category.id === editingId ? { ...category, name, color: draftColor } : category));
    else onChange([...categories, { id: uid(), name, color: draftColor }]);
    reset();
  };
  return <div className="category-manager">
    <div className="category-manager-header"><div><strong>Manage categories</strong><span>Use labels that make sense for your week.</span></div><button type="button" className="button-quiet" onClick={onClose}>Done</button></div>
    <div className="category-list">{categories.map(category => editingId === category.id ? <div className="category-edit-row" key={category.id}><input value={draftName} onChange={e => setDraftName(e.target.value)} aria-label="Category name" /><CategoryColorPicker value={draftColor} onChange={setDraftColor} /><button type="button" className="button-quiet" onClick={save} disabled={!draftName.trim()}>Save</button><button type="button" className="button-quiet" onClick={reset}>Cancel</button></div> : <div className="category-row" key={category.id}><span className="category-name"><span className="color-swatch" style={{ background: category.color }} />{category.name}</span><span className="category-row-actions"><CategoryColorPicker compact value={category.color} onChange={color => onChange(categories.map(item => item.id === category.id ? { ...item, color } : item))} /><button type="button" className="button-quiet" onClick={() => beginEdit(category)}><Pencil size={13} /> Edit</button><button type="button" className="button-quiet delete-category-button" onClick={() => { if (categories.length > 1) onChange(categories.filter(item => item.id !== category.id)); }} disabled={categories.length <= 1}>Delete</button></span></div>)}</div>
    <div className="category-new"><div className="category-manager-label">New category</div><div className="category-edit-row"><input value={editingId ? '' : draftName} onChange={e => { setEditingId(null); setDraftName(e.target.value); }} placeholder="e.g. Wellness" aria-label="New category name" /><CategoryColorPicker value={draftColor} onChange={setDraftColor} /><button type="button" className="button-accent compact-button" onClick={save} disabled={editingId !== null || !draftName.trim()}><Plus size={13} /> Add</button></div></div>
  </div>;
}

function CategoryField({ id, value, onChange, categories, onChangeCategories, onManageCategories }: { id: string; value: string; onChange: (value: string) => void; categories: Category[]; onChangeCategories: (categories: Category[]) => void; onManageCategories: () => void }) {
  const [open, setOpen] = useState(false);
  const selected = categories.find(category => category.name === value);
  return <div className="field full category-field">
    <div className="category-field-header"><label htmlFor={id}>Category</label><button type="button" className="button-quiet manage-categories-button" onClick={onManageCategories}><Pencil size={12} /> Manage categories</button></div>
    <div className="category-picker">
      <button type="button" id={id} className="category-picker-trigger" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`select-${id}`}><span className="category-name"><span className="color-swatch" style={{ background: selected?.color || '#6E879F' }} />{selected?.name || value}</span><ChevronRight size={14} className={open ? 'category-picker-chevron open' : 'category-picker-chevron'} /></button>
      {open && <div className="category-picker-menu">{categories.map(category => <div className="category-option" key={category.id}><button type="button" className="category-option-main" onClick={() => { onChange(category.name); setOpen(false); }}><span className="color-swatch" style={{ background: category.color }} />{category.name}</button><CategoryColorPicker compact value={category.color} onChange={color => onChangeCategories(categories.map(item => item.id === category.id ? { ...item, color } : item))} /></div>)}<button type="button" className="category-manage-link" onClick={() => { setOpen(false); onManageCategories(); }}><Pencil size={12} /> Manage categories</button></div>}
    </div>
    {selected && <span className="category-current"><span className="color-swatch" style={{ background: selected.color }} />{selected.name} label color</span>}
  </div>;
}

function EventForm({ event, initialDate, onSave, onClose, categories, onChangeCategories, onManageCategories }: { event?: EventItem; initialDate?: string; onSave: (event: EventItem) => void; onClose: () => void; categories: Category[]; onChangeCategories: (categories: Category[]) => void; onManageCategories: () => void }) {
  const [form, setForm] = useState<EventItem>(event || { id: uid(), title: '', description: '', date: initialDate || today(), startTime: '09:00', endTime: '10:00', category: categories[0]?.name || 'Campus' });
  return <>
    <div className="modal-header"><div><h2>{event ? 'Edit event' : 'Make a little room'}</h2><p>Add a fixed point to your week.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-event"><X size={16} /></button></div>
    <div className="form-grid">
      <div className="field full"><label htmlFor="event-title">Title</label><input id="event-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-event-title" placeholder="e.g. Walk around the Oval" /></div>
      <div className="field full"><label htmlFor="event-description">Description</label><textarea id="event-description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="input-event-description" placeholder="Add a little context, location, or preparation note." rows={3} /></div>
      <div className="field"><label htmlFor="event-date">Date</label><input id="event-date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-event-date" /></div>
      <CategoryField id="event-category" value={form.category} onChange={category => setForm({ ...form, category })} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={onManageCategories} />
      <div className="field"><label htmlFor="event-start">Starts</label><input id="event-start" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} data-testid="input-event-start" /></div>
      <div className="field"><label htmlFor="event-end">Ends</label><input id="event-end" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} data-testid="input-event-end" /></div>
    </div>
    <div className="modal-footer"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-event">Cancel</button><button className="button-primary" disabled={!form.title.trim()} onClick={() => { onSave({ ...form, title: form.title.trim() }); onClose(); }} data-testid="button-save-event">Save event</button></div>
  </>;
}

function EventModal({ event, initialDate, onSave, onClose, categories, onChangeCategories }: { event?: EventItem; initialDate?: string; onSave: (event: EventItem) => void; onClose: () => void; categories: Category[]; onChangeCategories: (categories: Category[]) => void }) {
  const [manageCategories, setManageCategories] = useState(false);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true">
    {manageCategories ? <CategoryManager categories={categories} onChange={onChangeCategories} onClose={() => setManageCategories(false)} /> : <EventForm event={event} initialDate={initialDate} onSave={onSave} onClose={onClose} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={() => setManageCategories(true)} />}
  </div></div>;
}

function DayDetailModal({ date, items, onAddEvent, onAddTask, onEditEvent, onEditTask, onClose }: { date: string; items: CalendarItem[]; onAddEvent: () => void; onAddTask: () => void; onEditEvent: (id: string) => void; onEditTask: (id: string) => void; onClose: () => void }) {
  const hours = Array.from({ length: 16 }, (_, index) => index + 7);
  const timedItems = items.filter(item => !item.isTask);
  const tasks = items.filter(item => item.isTask);
  const hourLabel = (hour: number) => new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(new Date(2020, 0, 1, hour));
  const eventsForHour = (hour: number) => timedItems.filter(item => Number(item.startTime.slice(0, 2)) === hour);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}>
    <div className="modal day-detail-modal" role="dialog" aria-modal="true" aria-labelledby="day-detail-title">
      <div className="modal-header"><div><div className="eyebrow">Day view</div><h2 id="day-detail-title">{formatLongDate(new Date(`${date}T12:00:00`))}</h2><p>A closer look at the shape of this day.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-day-detail"><X size={16} /></button></div>
      <div className="day-detail-actions"><button className="button-secondary" onClick={onAddEvent} data-testid="button-add-event-day-detail"><Plus size={14} /> Add event</button><button className="button-accent" onClick={onAddTask} data-testid="button-add-task-day-detail"><Plus size={14} /> Add task</button></div>
      {tasks.length > 0 && <div className="all-day-section"><div className="timeline-label">Tasks due</div><div className="all-day-items">{tasks.map(item => <button type="button" className="all-day-item detail-item-button" key={item.id} onClick={() => onEditTask(item.id)} data-testid={`detail-task-${item.id}`}><span className="task-event-marker" />{item.title}<span className="all-day-category">{item.category}</span></button>)}</div></div>}
      <div className="hourly-timeline">{hours.map(hour => <div className="hour-row" key={hour}><span className="hour-label">{hourLabel(hour)}</span><div className="hour-slot">{eventsForHour(hour).map(item => <button type="button" className="hour-event detail-item-button" onClick={() => onEditEvent(item.id)} key={item.id} data-testid={`detail-event-${item.id}`}><strong>{item.title}</strong><span>{item.startTime} — {item.endTime} · {item.category}</span></button>)}</div></div>)}</div>
      {timedItems.length === 0 && tasks.length === 0 && <div className="selected-day-empty day-detail-empty"><p>No plans yet.</p><span>Use this day as breathing room, or add one small fixed point.</span></div>}
    </div>
  </div>;
}

function parseVoiceDraft(transcript: string, kind: VoiceDraft['kind'], initialDate: string, categories: Category[]): VoiceDraft {
  const lower = transcript.toLowerCase();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const spokenDate = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
  const date = spokenDate ? iso(new Date(Number(spokenDate[3] || new Date().getFullYear()), monthNames.indexOf(spokenDate[1].toLowerCase()), Number(spokenDate[2]), 12)) : lower.includes('tomorrow') ? plusDays(1) : lower.includes('today') ? today() : initialDate;
  const times = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const to24Hour = (hour: number, meridiem?: string) => {
    if (!meridiem) return hour;
    const normalized = meridiem.toLowerCase();
    return normalized === 'pm' && hour < 12 ? hour + 12 : normalized === 'am' && hour === 12 ? 0 : hour;
  };
  const formatTime = (hour: number, minute = '00', meridiem?: string) => `${String(to24Hour(hour, meridiem)).padStart(2, '0')}:${minute}`;
  const category = categories.find(item => lower.includes(item.name.toLowerCase()))?.name || categories[0]?.name || '';
  const recurrence = lower.match(/\b(daily|weekly|biweekly|bi-weekly|monthly)\b/i)?.[1].replace('-', '') || '';
  const title = transcript.replace(/^\s*(event|task)\s*[:,-]?\s*/i, '').split(/\b(?:today|tomorrow|on|from|recurr(?:ing)?|daily|weekly|biweekly|bi-weekly|monthly)\b/i)[0].replace(/\s+(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*$/i, '').trim() || transcript.trim();
  return { kind, title, date, startTime: times ? formatTime(Number(times[1]), times[2], times[3]) : '09:00', endTime: times ? formatTime(Number(times[4]), times[5], times[6] || times[3]) : '10:00', category, recurrence };
}

function VoiceInputModal({ initialDate, categories, confirmationEnabled, onConfirmationChange, onSaveEvent, onSaveTask, onClose }: { initialDate: string; categories: Category[]; confirmationEnabled: boolean; onConfirmationChange: (value: boolean) => void; onSaveEvent: (event: EventItem) => void; onSaveTask: (task: Task) => void; onClose: () => void }) {
  const [kind, setKind] = useState<VoiceDraft['kind']>('event');
  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognitionRef = useState<{ current: SpeechRecognitionLike | null }>({ current: null })[0];
  const beginReview = (value: string) => {
    const nextDraft = parseVoiceDraft(value, kind, initialDate, categories);
    setTranscript(value);
    setDraft(nextDraft);
    setStep('review');
  };
  const saveDraft = (value: VoiceDraft) => {
    if (!value.title.trim()) return;
    if (value.kind === 'event') onSaveEvent({ id: uid(), title: value.title.trim(), date: value.date, startTime: value.startTime, endTime: value.endTime, category: value.category, recurrence: value.recurrence || undefined });
    else onSaveTask({ id: uid(), title: value.title.trim(), dueDate: value.date, category: value.category, priority: 'medium', completed: false, estimatedMinutes: 30, recurrence: value.recurrence || undefined });
    onClose();
  };
  const startListening = () => {
    const Recognition = (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!Recognition) { setMessage('Voice capture is unavailable here. Type what you would say below.'); return; }
    const recognition = new Recognition();
    recognition.continuous = true; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onresult = event => { const value = Array.from(event.results).map(result => result[0].transcript).join(' ').trim(); setTranscript(value); };
    recognition.onerror = () => { setListening(false); setMessage('I could not hear that. Try again, or type the entry below.'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition; setMessage(''); setListening(true); recognition.start();
  };
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const field = (label: string, value: string, onChange: (value: string) => void, type = 'text') => <div className="field"><label>{label}</label><input type={type} value={value} onChange={event => onChange(event.target.value)} /></div>;
  const reviewVoice = () => { const value = transcript.trim(); if (value) beginReview(value); };
  const recurrenceOption = draft?.recurrence.startsWith('custom:') ? 'custom' : draft?.recurrence || '';
  const customRecurrenceDate = draft?.recurrence.startsWith('custom:') ? draft.recurrence.slice(7) : draft?.date || initialDate;
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}><div className="modal voice-modal" role="dialog" aria-modal="true" aria-labelledby="voice-input-title">
    <div className="modal-header"><div><div className="eyebrow">Voice entry</div><h2 id="voice-input-title">{step === 'capture' ? 'Say what you need to remember' : 'Check the details'}</h2><p>{step === 'capture' ? 'Speak naturally. I will shape it into a calendar entry.' : 'Make any small correction before it joins your calendar.'}</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-voice"><X size={16} /></button></div>
    {step === 'capture' ? <><div className="entry-tabs voice-kind-tabs"><button type="button" className={kind === 'event' ? 'active' : ''} onClick={() => setKind('event')} data-testid="voice-kind-event"><span className="entry-tab-dot event-dot" />Event</button><button type="button" className={kind === 'task' ? 'active' : ''} onClick={() => setKind('task')} data-testid="voice-kind-task"><span className="entry-tab-dot task-dot" />Task</button></div><div className="voice-prompt"><Mic size={20} /><div><strong>Tell me these five things</strong><span>Name, date, time range, category if useful, and whether it repeats.</span></div></div><ul className="voice-reminders"><li>Name the {kind}</li><li>Say the date and time range{kind === 'task' ? ' if it has one' : ''}</li><li>Add a category or recurrence if helpful</li></ul><button className={`voice-record-button ${listening ? 'listening' : ''}`} onClick={listening ? () => recognitionRef.current?.stop() : startListening} data-testid="button-start-voice"><span>{listening ? <Square size={15} /> : <Mic size={18} />}</span>{listening ? 'Listening... tap to stop' : 'Start speaking'}</button><div className="field voice-transcript-field"><label htmlFor="voice-transcript">Or type your words</label><textarea id="voice-transcript" rows={3} value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="Event study group tomorrow from 3 to 4 pm, Academics, recurring weekly" data-testid="input-voice-transcript" /></div>{message && <p className="voice-message">{message}</p>}<div className="voice-setting"><div><strong>Review before adding</strong><span>Keep the confirmation step on for more control.</span></div><input type="checkbox" checked={confirmationEnabled} onChange={event => onConfirmationChange(event.target.checked)} aria-label="Review before adding" data-testid="toggle-voice-confirmation" /></div><div className="modal-footer"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!transcript.trim()} onClick={() => { if (confirmationEnabled) reviewVoice(); else saveDraft(parseVoiceDraft(transcript.trim(), kind, initialDate, categories)); }} data-testid="button-parse-voice">{confirmationEnabled ? 'Review entry' : 'Add entry'}</button></div></> : <><div className="voice-transcript"><span>Heard</span><p>“{transcript}”</p></div><div className="form-grid"><div className="field full"><label>Title</label><input value={draft?.title || ''} onChange={event => setDraft(draft ? { ...draft, title: event.target.value } : draft)} data-testid="input-voice-title" /></div>{field(kind === 'event' ? 'Date' : 'Due date', draft?.date || '', value => setDraft(draft ? { ...draft, date: value } : draft), 'date')}{field('Category (optional)', draft?.category || '', value => setDraft(draft ? { ...draft, category: value } : draft))}{kind === 'event' && <>{field('Starts', draft?.startTime || '', value => setDraft(draft ? { ...draft, startTime: value } : draft), 'time')}{field('Ends', draft?.endTime || '', value => setDraft(draft ? { ...draft, endTime: value } : draft), 'time')}</>}{<div className="field"><label htmlFor="voice-recurrence">Repeats (optional)</label><select id="voice-recurrence" value={recurrenceOption} onChange={event => setDraft(draft ? { ...draft, recurrence: event.target.value } : draft)} data-testid="select-voice-recurrence"><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="custom">Custom date</option></select></div>}{recurrenceOption === 'custom' && field('Custom date', customRecurrenceDate, value => setDraft(draft ? { ...draft, recurrence: `custom:${value}` } : draft), 'date')}</div><div className="modal-footer"><button className="button-secondary" onClick={() => setStep('capture')}>Back</button><button className="button-primary" disabled={!draft?.title.trim()} onClick={() => draft && saveDraft(draft)} data-testid="button-confirm-voice">Confirm and add</button></div></>}
  </div></div>;
}

function CalendarPage({ tasks, events, setTasks, setEvents, categories, setCategories, notify, settings, setSettings }: { tasks: Task[]; events: EventItem[]; setTasks: (v: Task[]) => void; setEvents: (v: EventItem[]) => void; categories: Category[]; setCategories: (v: Category[]) => void; notify: (v: string) => void; settings: Settings; setSettings: (v: Settings) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [entry, setEntry] = useState<{ type: 'event'; item?: EventItem } | { type: 'task'; item?: Task } | null>(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const first = new Date(year, month, 1); const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const move = (amount: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + (view === 'month' ? amount : 0), d.getDate() + (view === 'week' ? amount * 7 : 0)); setCursor(d); };
  const dayItems = (day: Date): CalendarItem[] => {
    const date = iso(day);
    return [
      ...events.filter(e => e.date === date).map(e => ({ ...e, isTask: false })),
      ...tasks.filter(t => t.dueDate === date).map(t => ({ id: t.id, title: t.title, description: t.description, category: t.category, isTask: true, startTime: '', endTime: '' })),
    ];
  };
  const selectDay = (day: Date) => setSelectedDate(iso(day));
  const openDayDetail = (day: Date) => {
    selectDay(day);
    setDetailDate(iso(day));
  };
  const saveEvent = (event: EventItem) => {
    setEvents(events.some(e => e.id === event.id) ? events.map(e => e.id === event.id ? event : e) : [...events, event]);
    setSelectedDate(event.date);
    setCursor(new Date(`${event.date}T12:00:00`));
    notify('Event added to your week.');
  };
  const saveTask = (task: Task) => {
    setTasks(tasks.some(t => t.id === task.id) ? tasks.map(t => t.id === task.id ? task : t) : [task, ...tasks]);
    setSelectedDate(task.dueDate);
    setCursor(new Date(`${task.dueDate}T12:00:00`));
    notify('Task saved.');
  };
  const editEvent = (id: string) => {
    const event = events.find(item => item.id === id);
    if (event) {
      setDetailDate(null);
      setEntry({ type: 'event', item: event });
    }
  };
  const editTask = (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (task) {
      setDetailDate(null);
      setEntry({ type: 'task', item: task });
    }
  };
  const categoryColor = (name: string) => categories.find(category => category.name === name)?.color || '#6E879F';
  return <div className="content">
    <div className="page-heading"><div className="heading-copy"><div className="eyebrow">A wider view</div><h1 className="display-title">Calendar</h1><p>See the shape of your time before it fills up. Tasks and events share the same quiet table.</p></div><div className="calendar-actions"><button className="button-secondary" onClick={() => setVoiceOpen(true)} data-testid="button-voice-input"><Mic size={15} /> Speak an entry</button><button className="button-accent" onClick={() => setEntry({ type: 'task' })} data-testid="button-add-task-calendar"><Plus size={15} /> Add task</button><button className="button-primary" onClick={() => setEntry({ type: 'event' })} data-testid="button-add-event"><Plus size={15} /> Add event</button></div></div>
    <div className="card card-pad">
      <div className="calendar-toolbar"><button className="icon-button" onClick={() => move(-1)} data-testid="button-calendar-prev"><ChevronLeft size={15} /></button><button className="icon-button" onClick={() => { setCursor(new Date()); }} data-testid="button-calendar-today"><Sun size={14} /></button><button className="icon-button" onClick={() => move(1)} data-testid="button-calendar-next"><ChevronRight size={15} /></button><h2>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursor)}</h2><div className="calendar-view-toggle"><button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')} data-testid="button-calendar-month">Month</button><button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')} data-testid="button-calendar-week">Week</button></div></div>
      {view === 'month' ? <div className="calendar-wrap"><div className="calendar-grid" style={{ marginTop: 20 }}><>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-head" key={day}>{day}</div>)}{cells.map(day => { const date = iso(day); const items = dayItems(day); return <button type="button" className={`calendar-cell ${day.getMonth() !== month ? 'muted-day' : ''} ${date === today() ? 'today' : ''} ${date === selectedDate ? 'selected-day' : ''}`} onClick={() => selectDay(day)} onDoubleClick={() => openDayDetail(day)} aria-label={`Select ${formatLongDate(day)}. Double-click to open day view.`} key={date} data-testid={`button-calendar-day-${date}`}><div className="day-number">{day.getDate()}</div>{items.slice(0, 3).map(item => <div className={`calendar-event ${item.isTask ? 'task-event' : ''}`} style={{ borderLeftColor: categoryColor(item.category) }} title={item.title} key={`${item.id}-${item.isTask}`}>{item.title}</div>)}{items.length > 3 && <div className="calendar-more">+{items.length - 3} more</div>}</button>; })}</></div></div> : <div className="week-grid-wrap" style={{ marginTop: 20 }}><WeekView cursor={cursor} dayItems={dayItems} selectedDate={selectedDate} onSelectDay={selectDay} onOpenDayDetail={openDayDetail} categoryColor={categoryColor} /></div>}
      <div className="calendar-interaction-hint">Single-click a day to select it. Double-click to open its hourly timeline.</div>
    </div>
    {entry && <CalendarItemModal entry={entry} initialDate={selectedDate} categories={categories} onChangeCategories={setCategories} onSaveEvent={saveEvent} onSaveTask={saveTask} onClose={() => setEntry(null)} />}
    {voiceOpen && <VoiceInputModal initialDate={selectedDate} categories={categories} confirmationEnabled={settings.voiceConfirmation !== false} onConfirmationChange={value => setSettings({ ...settings, voiceConfirmation: value })} onSaveEvent={saveEvent} onSaveTask={saveTask} onClose={() => setVoiceOpen(false)} />}
    {detailDate && <DayDetailModal date={detailDate} items={dayItems(new Date(`${detailDate}T12:00:00`))} onAddEvent={() => { setDetailDate(null); setEntry({ type: 'event' }); }} onAddTask={() => { setDetailDate(null); setEntry({ type: 'task' }); }} onEditEvent={editEvent} onEditTask={editTask} onClose={() => setDetailDate(null)} />}
  </div>;
}

function WeekView({ cursor, dayItems, selectedDate, onSelectDay, onOpenDayDetail, categoryColor }: { cursor: Date; dayItems: (d: Date) => CalendarItem[]; selectedDate: string; onSelectDay: (day: Date) => void; onOpenDayDetail: (day: Date) => void; categoryColor: (name: string) => string }) {
  const weekStart = new Date(cursor); weekStart.setDate(cursor.getDate() - cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const times = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  return <div className="week-grid"><div className="week-time" />{days.map(d => { const date = iso(d); return <button type="button" className={`week-time week-day-button ${date === selectedDate ? 'selected-week-day' : ''}`} onClick={() => onSelectDay(d)} onDoubleClick={() => onOpenDayDetail(d)} key={date} style={{ color: date === today() ? 'hsl(var(--accent))' : undefined }} data-testid={`button-calendar-week-day-${date}`}>{new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(d)}</button>; })}{times.map(time => <div className="contents" key={time}><div className="week-time">{time}</div>{days.map(day => <button type="button" className={`week-cell ${iso(day) === selectedDate ? 'selected-week-cell' : ''}`} onClick={() => onSelectDay(day)} onDoubleClick={() => onOpenDayDetail(day)} key={`${time}-${iso(day)}`} aria-label={`View ${formatLongDate(day)} around ${time}`} data-testid={`button-calendar-week-cell-${iso(day)}-${time}`}>{time === '08:00' && dayItems(day).slice(0, 2).map(item => <div className="week-event" style={{ borderLeftColor: categoryColor(item.category) }} key={`${item.id}-${item.isTask}`}>{item.title}</div>)}</button>)}</div>)}</div>;
}

function TaskForm({ task, initialDate, onSave, onClose, categories, onChangeCategories, onManageCategories }: { task?: Task; initialDate?: string; onSave: (task: Task) => void; onClose: () => void; categories: Category[]; onChangeCategories: (categories: Category[]) => void; onManageCategories: () => void }) {
  const [form, setForm] = useState<Task>(task || { id: uid(), title: '', description: '', dueDate: initialDate || today(), category: categories[0]?.name || 'Academics', priority: 'medium', completed: false, estimatedMinutes: 30 });
  return <>
    <div className="modal-header"><div><h2>{task ? 'Refine the task' : 'Add a task'}</h2><p>Keep the next step concrete and kind.</p></div><button className="icon-button" onClick={onClose} data-testid="button-close-task"><X size={16} /></button></div>
    <div className="form-grid">
      <div className="field full"><label htmlFor="task-title">Task</label><input id="task-title" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-task-title" placeholder="What would feel good to finish?" /></div>
      <div className="field full"><label htmlFor="task-description">Description</label><textarea id="task-description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="input-task-description" placeholder="Add the context or next step you want to remember." rows={3} /></div>
      <div className="field"><label htmlFor="task-date">Due date</label><input id="task-date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} data-testid="input-task-due-date" /></div>
      <CategoryField id="task-category" value={form.category} onChange={category => setForm({ ...form, category })} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={onManageCategories} />
      <div className="field"><label htmlFor="task-priority">Priority</label><select id="task-priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })} data-testid="select-task-priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
      <div className="field"><label htmlFor="task-time">Estimate (minutes)</label><input id="task-time" type="number" min="5" step="5" value={form.estimatedMinutes} onChange={e => setForm({ ...form, estimatedMinutes: Number(e.target.value) })} data-testid="input-task-estimate" /></div>
    </div>
    <div className="modal-footer"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-task">Cancel</button><button className="button-primary" disabled={!form.title.trim()} onClick={() => { onSave({ ...form, title: form.title.trim() }); onClose(); }} data-testid="button-save-task">Save task</button></div>
  </>;
}

function TaskModal({ task, initialDate, onSave, onClose, categories, onChangeCategories }: { task?: Task; initialDate?: string; onSave: (task: Task) => void; onClose: () => void; categories: Category[]; onChangeCategories: (categories: Category[]) => void }) {
  const [manageCategories, setManageCategories] = useState(false);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal" role="dialog" aria-modal="true">
    {manageCategories ? <CategoryManager categories={categories} onChange={onChangeCategories} onClose={() => setManageCategories(false)} /> : <TaskForm task={task} initialDate={initialDate} onSave={onSave} onClose={onClose} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={() => setManageCategories(true)} />}
  </div></div>;
}

function CalendarItemModal({ entry, initialDate, categories, onChangeCategories, onSaveEvent, onSaveTask, onClose }: { entry: { type: 'event'; item?: EventItem } | { type: 'task'; item?: Task }; initialDate: string; categories: Category[]; onChangeCategories: (categories: Category[]) => void; onSaveEvent: (event: EventItem) => void; onSaveTask: (task: Task) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'event' | 'task'>(entry.type);
  const [manageCategories, setManageCategories] = useState(false);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><div className="modal calendar-entry-modal" role="dialog" aria-modal="true">
    <div className="entry-tabs" role="tablist" aria-label="Add calendar item"><button type="button" role="tab" aria-selected={activeTab === 'event'} className={activeTab === 'event' ? 'active' : ''} onClick={() => setActiveTab('event')} data-testid="tab-add-event"><span className="entry-tab-dot event-dot" />Event</button><button type="button" role="tab" aria-selected={activeTab === 'task'} className={activeTab === 'task' ? 'active' : ''} onClick={() => setActiveTab('task')} data-testid="tab-add-task"><span className="entry-tab-dot task-dot" />Task</button></div>
    {manageCategories ? <CategoryManager categories={categories} onChange={onChangeCategories} onClose={() => setManageCategories(false)} /> : activeTab === 'event' ? <EventForm event={entry.type === 'event' ? entry.item : undefined} initialDate={initialDate} onSave={onSaveEvent} onClose={onClose} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={() => setManageCategories(true)} /> : <TaskForm task={entry.type === 'task' ? entry.item : undefined} initialDate={initialDate} onSave={onSaveTask} onClose={onClose} categories={categories} onChangeCategories={onChangeCategories} onManageCategories={() => setManageCategories(true)} />}
  </div></div>;
}

function TasksPage({ tasks, setTasks, categories, setCategories, notify }: { tasks: Task[]; setTasks: (v: Task[]) => void; categories: Category[]; setCategories: (v: Category[]) => void; notify: (v: string) => void }) {
  const [filter, setFilter] = useState('All'); const [modal, setModal] = useState<Task | 'new' | null>(null);
  const filterCategories = ['All', ...categories.map(category => category.name)];
  const filtered = tasks.filter(t => filter === 'All' || t.category === filter).sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate));
  const save = (task: Task) => { setTasks(tasks.some(t => t.id === task.id) ? tasks.map(t => t.id === task.id ? task : t) : [task, ...tasks]); notify('Task saved.'); };
  const toggle = (id: string) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const remove = (id: string) => { if (window.confirm('Delete this task?')) { setTasks(tasks.filter(t => t.id !== id)); notify('Task cleared.'); } };
  return <div className="content"><div className="page-heading"><div className="heading-copy"><div className="eyebrow">The inbox</div><h1 className="display-title">Tasks</h1><p>Everything you want to carry, in one considered place. Sort the noise; keep the signal.</p></div><button className="button-primary" onClick={() => setModal('new')} data-testid="button-add-task"><Plus size={15} /> New task</button></div>
    <div className="filter-row">{filterCategories.map(category => <button className={`filter-chip ${filter === category ? 'active' : ''}`} onClick={() => setFilter(category)} key={category} data-testid={`button-filter-${category.toLowerCase().replace(' ', '-')}`}>{category}</button>)}<span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', font: '10px var(--app-font-mono)' }}>{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</span></div>
    <div className="task-inbox"><section className="card">{filtered.length ? filtered.map(task => <div className="inbox-row" key={task.id}><TaskCheck task={task} onToggle={() => toggle(task.id)} /><div><div className={`inbox-title ${task.completed ? 'task-name done' : ''}`} data-testid={`text-inbox-task-${task.id}`}>{task.title}</div><div className="inbox-details"><span>{task.dueDate === today() ? 'Today' : formatShortDate(task.dueDate)}</span><span className="tag">{task.category}</span><span><Clock3 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{task.estimatedMinutes} min</span></div></div><div className="row-actions"><button className="button-quiet" onClick={() => setModal(task)} data-testid={`button-edit-task-${task.id}`} aria-label={`Edit ${task.title}`}><Pencil size={14} /></button><button className="button-quiet" onClick={() => remove(task.id)} data-testid={`button-delete-task-${task.id}`} aria-label={`Delete ${task.title}`}><Trash2 size={14} /></button></div></div>) : <div className="empty-state" style={{ padding: '60px 20px' }}><Flag size={24} /><p>Nothing is asking for you.</p><span>Try a different filter or start with one small next step.</span></div>}</section>
      <aside className="card card-pad"><SectionTitle title="A softer metric" /><div className="stat-box" style={{ marginBottom: 10 }}><b>{tasks.filter(t => t.completed).length}</b><span>tasks completed</span></div><div className="stat-box"><b>{Math.round(tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60 * 10) / 10}h</b><span>open focus time</span></div><p style={{ fontFamily: 'var(--app-font-serif)', fontSize: 18, lineHeight: 1.25, color: 'hsl(var(--primary))' }}>Progress is not a personality test.</p></aside></div>
    {modal && <TaskModal task={modal === 'new' ? undefined : modal} onSave={save} onClose={() => setModal(null)} categories={categories} onChangeCategories={setCategories} />}
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

function Router({ tasks, events, habits, categories, settings, setTasks, setEvents, setHabits, setCategories, setSettings, notify, openTask }: {
  tasks: Task[]; events: EventItem[]; habits: Habit[]; categories: Category[]; settings: Settings; setTasks: (v: Task[]) => void; setEvents: (v: EventItem[]) => void; setHabits: (v: Habit[]) => void; setCategories: (v: Category[]) => void; setSettings: (v: Settings) => void; notify: (v: string) => void; openTask: () => void;
}) {
  return <Switch><Route path="/"><TodayPage tasks={tasks} events={events} habits={habits} settings={settings} setTasks={setTasks} setHabits={setHabits} setSettings={setSettings} notify={notify} openTask={openTask} /></Route><Route path="/calendar"><CalendarPage tasks={tasks} events={events} setTasks={setTasks} setEvents={setEvents} categories={categories} setCategories={setCategories} notify={notify} settings={settings} setSettings={setSettings} /></Route><Route path="/tasks"><TasksPage tasks={tasks} setTasks={setTasks} categories={categories} setCategories={setCategories} notify={notify} /></Route><Route path="/habits"><HabitsPage habits={habits} setHabits={setHabits} notify={notify} /></Route><Route path="/roadmap"><RoadmapPage /></Route><Route component={NotFound} /></Switch>;
}

function App() {
  const seed = useMemo(() => defaultData(), []);
  const [tasks, setTasks] = useLocalStore<Task[]>('stanford-hub-tasks', seed.tasks);
  const [events, setEvents] = useLocalStore<EventItem[]>('stanford-hub-events', seed.events);
  const [habits, setHabits] = useLocalStore<Habit[]>('stanford-hub-habits', seed.habits);
  const [categories, setCategories] = useLocalStore<Category[]>('stanford-hub-categories', seed.categories);
  const [settings, setSettings] = useLocalStore<Settings>('stanford-hub-settings', seed.settings);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [location, setLocation] = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const openTask = () => { if (location !== '/tasks') setLocation('/tasks'); };
  const updateCategories = (nextCategories: Category[]) => {
    const renamed = categories.find(category => {
      const next = nextCategories.find(candidate => candidate.id === category.id);
      return next && next.name !== category.name;
    });
    const removed = categories.find(category => !nextCategories.some(candidate => candidate.id === category.id));
    const replacement = nextCategories[0];
    if (renamed) {
      const nextName = nextCategories.find(category => category.id === renamed.id)?.name;
      if (nextName) {
        setTasks(tasks.map(task => task.category === renamed.name ? { ...task, category: nextName } : task));
        setEvents(events.map(event => event.category === renamed.name ? { ...event, category: nextName } : event));
      }
    }
    if (removed && replacement) {
      setTasks(tasks.map(task => task.category === removed.name ? { ...task, category: replacement.name } : task));
      setEvents(events.map(event => event.category === removed.name ? { ...event, category: replacement.name } : event));
    }
    setCategories(nextCategories);
  };
  return <QueryClientProvider client={queryClient}><TooltipProvider><AppShell settings={settings} onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}><ErrorBoundary resetKey={location}><Router tasks={tasks} events={events} habits={habits} categories={categories} settings={settings} setTasks={setTasks} setEvents={setEvents} setHabits={setHabits} setCategories={updateCategories} setSettings={setSettings} notify={notify} openTask={openTask} /></ErrorBoundary></AppShell>{toast && <div className="toast" data-testid="status-toast">{toast}</div>}<Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;