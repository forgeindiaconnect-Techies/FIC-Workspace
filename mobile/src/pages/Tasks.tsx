import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Plus, MoreHorizontal, Clock, Filter, X, Trash2 } from 'lucide-react-native';
import { api, getSession } from '../lib/api';



const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#94a3b8' },
  { id: 'in-progress', title: 'Running', color: '#2563eb' },
  { id: 'done', title: 'Done', color: '#10b981' },
];

const PRIORITIES = ['low', 'medium', 'high'] as const;
type Priority = typeof PRIORITIES[number];
type Status = 'todo' | 'in-progress' | 'done';

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assigneeName?: string;
  dueDate?: string;
}

const priorityStyle = (priority: Priority, styles: any) => {
  if (priority === 'high') return { badge: styles.priorityHigh, text: styles.textHigh };
  if (priority === 'medium') return { badge: styles.priorityMed, text: styles.textMed };
  return { badge: styles.priorityLow, text: styles.textLow };
};

const formatDue = (dateStr?: string) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function Tasks() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const styles = React.useMemo(() => getStyles(width, isMobile), [width, isMobile]);

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createVisible, setCreateVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // New task form state
  const [newTitle, setNewTitle] = React.useState('');
  const [newDescription, setNewDescription] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<Priority>('medium');
  const [newStatus, setNewStatus] = React.useState<Status>('todo');
  const [newAssignee, setNewAssignee] = React.useState('');
  const [newDueDate, setNewDueDate] = React.useState('');

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.tasks.getTasks(workspaceId);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    setSaving(true);
    try {
      await api.tasks.createTask({
        workspaceId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        status: newStatus,
        priority: newPriority,
        assigneeName: newAssignee.trim(),
        dueDate: newDueDate.trim() || undefined,
      });
      setCreateVisible(false);
      resetForm();
      await loadTasks();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task: Task, newStatusValue: Status) => {
    // Optimistic update
    setTasks(prev =>
      prev.map(t => (t._id === task._id ? { ...t, status: newStatusValue } : t))
    );
    try {
      await api.tasks.updateTask(task._id, { status: newStatusValue });
    } catch (err) {
      console.warn('Failed to update task status:', err);
      await loadTasks(); // Revert on failure
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setTasks(prev => prev.filter(t => t._id !== taskId));
          try {
            await api.tasks.deleteTask(taskId);
          } catch (err) {
            console.warn('Failed to delete task:', err);
            await loadTasks();
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewPriority('medium');
    setNewStatus('todo');
    setNewAssignee('');
    setNewDueDate('');
  };

  const renderCreateModal = () => (
    <Modal
      visible={createVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setCreateVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Task</Text>
            <TouchableOpacity onPress={() => { setCreateVisible(false); resetForm(); }}>
              <X size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What needs to be done?"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Optional details..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.segmentRow}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.segmentBtn, newPriority === p && styles.segmentBtnActive]}
                    onPress={() => setNewPriority(p)}
                  >
                    <Text style={[styles.segmentText, newPriority === p && styles.segmentTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.segmentRow}>
                {COLUMNS.map(col => (
                  <TouchableOpacity
                    key={col.id}
                    style={[styles.segmentBtn, newStatus === col.id && styles.segmentBtnActive]}
                    onPress={() => setNewStatus(col.id as Status)}
                  >
                    <Text style={[styles.segmentText, newStatus === col.id && styles.segmentTextActive]}>
                      {col.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Assignee Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newAssignee}
                onChangeText={setNewAssignee}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Due Date</Text>
              <TextInput
                style={styles.modalInput}
                value={newDueDate}
                onChangeText={setNewDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setCreateVisible(false); resetForm(); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateTask}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderCreateModal()}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabs}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Board</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={18} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => setCreateVisible(true)}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.newButtonText}>New Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Board */}
      {loading ? (
        <View style={styles.loadingPane}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          showsHorizontalScrollIndicator={false}
        >
          {COLUMNS.map(column => {
            const columnTasks = tasks.filter(t => t.status === column.id);
            return (
              <View key={column.id} style={styles.column}>
                <View style={styles.columnHeader}>
                  <View style={styles.columnTitleContainer}>
                    <View style={[styles.dot, { backgroundColor: column.color }]} />
                    <Text style={styles.columnTitle}>{column.title}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{columnTasks.length}</Text>
                    </View>
                  </View>
                </View>

                <ScrollView
                  style={styles.taskList}
                  contentContainerStyle={styles.taskListContent}
                >
                  {columnTasks.map(task => {
                    const { badge, text } = priorityStyle(task.priority, styles);
                    const due = formatDue(task.dueDate);
                    const initials = task.assigneeName
                      ? task.assigneeName
                          .split(' ')
                          .slice(0, 2)
                          .map(n => n[0]?.toUpperCase())
                          .join('')
                      : null;

                    return (
                      <View key={task._id} style={styles.taskCard}>
                        <View style={styles.taskHeader}>
                          <View style={[styles.priorityBadge, badge]}>
                            <Text style={[styles.priorityText, text]}>
                              {task.priority}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteTask(task._id)}
                            style={styles.deleteBtn}
                          >
                            <Trash2 size={14} color="#cbd5e1" />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.taskTitle}>{task.title}</Text>

                        {task.description ? (
                          <Text style={styles.taskDesc} numberOfLines={2}>
                            {task.description}
                          </Text>
                        ) : null}

                        {/* Status move buttons */}
                        <View style={styles.statusRow}>
                          {COLUMNS.filter(c => c.id !== task.status).map(c => (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.moveBtn, { borderColor: c.color }]}
                              onPress={() => handleStatusChange(task, c.id as Status)}
                            >
                              <Text style={[styles.moveBtnText, { color: c.color }]}>
                                 {c.title}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={styles.taskFooter}>
                          {due ? (
                            <View style={styles.dateContainer}>
                              <Clock size={12} color="#94a3b8" />
                              <Text style={styles.dateText}>{due}</Text>
                            </View>
                          ) : (
                            <View />
                          )}
                          {initials ? (
                            <View style={styles.assignee}>
                              <Text style={styles.assigneeText}>{initials}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <View style={styles.emptyColumn}>
                      <Text style={styles.emptyColumnText}>No tasks</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addCardButton}
                    onPress={() => {
                      setNewStatus(column.id as Status);
                      setCreateVisible(true);
                    }}
                  >
                    <Plus size={16} color="#94a3b8" />
                    <Text style={styles.addCardText}>Add Card</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (width: number, isMobile: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    gap: 24,
  },
  header: {
    flexDirection: Platform.OS === 'web' && width > 768 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' && width > 768 ? 'center' : 'flex-start',
    gap: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 4,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: '#0f172a',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: Platform.OS === 'web' && width < 768 ? '100%' : 'auto',
  },
  filterButton: {
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
  },
  newButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  loadingPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  board: {
    flex: 1,
  },
  boardContent: {
    paddingRight: 24,
    gap: 24,
  },
  column: {
    width: width > 768 ? 384 : 320,
    gap: 20,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  columnTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
  },
  taskList: {
    flex: 1,
  },
  taskListContent: {
    gap: 16,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    borderRadius: 32,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityHigh: { backgroundColor: '#fef2f2' },
  priorityMed: { backgroundColor: '#fffbeb' },
  priorityLow: { backgroundColor: '#f8fafc' },
  priorityText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textHigh: { color: '#ef4444' },
  textMed: { color: '#f59e0b' },
  textLow: { color: '#64748b' },
  deleteBtn: {
    padding: 4,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: 21,
  },
  taskDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  moveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  moveBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  assignee: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  emptyColumn: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyColumnText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  addCardButton: {
    width: '100%',
    padding: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCardText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  formGroup: {
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 72,
    paddingTop: 11,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
