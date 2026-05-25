import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, MoreHorizontal, CheckCircle2, Circle, Clock, AlertCircle, X, Tag, User } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const PRIORITY_CONFIG = {
  high: { label: 'High', style: { background: 'color-mix(in srgb, #EF4444 10%, transparent)', color: '#EF4444' } },
  medium: { label: 'Medium', style: { background: 'color-mix(in srgb, #F59E0B 10%, transparent)', color: '#F59E0B' } },
  low: { label: 'Low', style: { background: 'color-mix(in srgb, #10B981 10%, transparent)', color: '#10B981' } },
};

const TaskBoard = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'demo';
  const [tasks, setTasks] = useLocalStorage(`task_items_${workspaceId}`, {
    todo: [],
    inProgress: [],
    done: []
  });
  const [newTaskModal, setNewTaskModal] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', desc: '', priority: 'medium', assignee: '', due: '' });

  const addTask = (e) => {
    e.preventDefault();
    const task = { id: Date.now(), ...newTask };
    setTasks(prev => ({ ...prev, [newTaskModal]: [task, ...prev[newTaskModal]] }));
    setNewTaskModal(null);
    setNewTask({ title: '', desc: '', priority: 'medium', assignee: '', due: '' });
  };

  const columns = [
    { key: 'todo', label: 'To Do', icon: <Circle size={14} style={{ color: 'var(--text-3)' }} /> },
    { key: 'inProgress', label: 'In Progress', icon: <AlertCircle size={14} style={{ color: '#F59E0B' }} /> },
    { key: 'done', label: 'Done', icon: <CheckCircle2 size={14} style={{ color: '#10B981' }} /> },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Project Flow</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            {Object.values(tasks).flat().length} tasks · {tasks.inProgress.length} in progress
          </p>
        </div>
        <button onClick={() => setNewTaskModal('todo')} className="btn btn-primary">
          <Plus size={16} /> New task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-[calc(100vh-200px)]">
        {columns.map(({ key, label, icon }) => (
          <div key={key} className="flex flex-col overflow-hidden">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                  {tasks[key].length}
                </span>
              </div>
              <button onClick={() => setNewTaskModal(key)} className="btn btn-ghost btn-icon" style={{ width: '24px', height: '24px' }}>
                <Plus size={13} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {tasks[key].map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
              <button onClick={() => setNewTaskModal(key)}
                className="w-full py-2 rounded-xl text-xs font-medium border-2 border-dashed transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}
              >
                + Add task
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setNewTaskModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl border shadow-2xl animate-up" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold">Add task</h2>
              <button onClick={() => setNewTaskModal(null)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
            </div>
            <form onSubmit={addTask} className="p-5 space-y-4">
              <div>
                <label className="label">Task title</label>
                <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="input" placeholder="What needs to be done?" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={newTask.desc} onChange={e => setNewTask({...newTask, desc: e.target.value})} className="input resize-none" rows={3} placeholder="Optional details..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="input">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assignee</label>
                  <input type="text" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})} className="input" placeholder="AR" />
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input type="text" value={newTask.due} onChange={e => setNewTask({...newTask, due: e.target.value})} className="input" placeholder="Apr 30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setNewTaskModal(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const TaskCard = ({ task }) => {
  const priority = PRIORITY_CONFIG[task.priority];
  return (
    <div className="card p-4 cursor-pointer group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <button className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: '22px', height: '22px' }}>
          <MoreHorizontal size={13} />
        </button>
      </div>
      {task.desc && <p className="text-xs mb-3 truncate-2 leading-relaxed" style={{ color: 'var(--text-3)' }}>{task.desc}</p>}
      <div className="flex items-center justify-between">
        <span className="status text-[10px]" style={priority.style}>{priority.label}</span>
        <div className="flex items-center gap-2">
          {task.due && (
            <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
              <Clock size={10} /> {task.due}
            </div>
          )}
          {task.assignee && (
            <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              {task.assignee}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
