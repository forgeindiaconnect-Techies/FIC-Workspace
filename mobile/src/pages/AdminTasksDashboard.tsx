import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Calendar, Plus, TrendingUp, Filter, MoreVertical, ClipboardCheck, X, Check } from 'lucide-react-native';
import { api, getSession } from '../lib/api';
import { Task, User } from '../types';

export default function AdminTasksDashboard() {
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024;
  const isMedium = width >= 768;

  const styles = useMemo(() => getStyles(width, isLarge, isMedium), [width, isLarge, isMedium]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Completed tasks toggle
  const [showCompleted, setShowCompleted] = useState(false);

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low'|'medium'|'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Feedback State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const { user } = getSession();
      const workspaceId = user?.workspaceId || 'antigraviity-hq';
      
      const [fetchedTasks, fetchedMembers] = await Promise.all([
        api.tasks.getTasks(workspaceId),
        api.members.getMembers(workspaceId)
      ]);
      
      setTasks(fetchedTasks || []);
      setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : (fetchedMembers.members || []));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }

    try {
      const { user } = getSession();
      const workspaceId = user?.workspaceId || 'antigraviity-hq';

      const assigneeObj = members.find(m => m.email === newTaskAssignee);

      await api.tasks.createTask({
        workspaceId,
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        assigneeEmail: newTaskAssignee,
        assigneeName: assigneeObj?.name || '',
        dueDate: newTaskDueDate || undefined,
      });

      setShowCreateModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskAssignee('');
      setNewTaskPriority('medium');
      setNewTaskDueDate('');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task');
    }
  };

  const handleApprove = async (task: Task) => {
    try {
      await api.tasks.updateTask(task._id, { status: 'done' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve task');
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedTask) return;
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please provide feedback for the rejection');
      return;
    }

    try {
      await api.tasks.updateTask(selectedTask._id, { 
        status: 'in-progress',
        feedback: feedbackText
      });
      setShowFeedbackModal(false);
      setFeedbackText('');
      setSelectedTask(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject task');
    }
  };

  const { user } = getSession();
  const myActiveTasks = tasks.filter(t => t.assigneeEmail === user?.email && t.status !== 'done' && t.status !== 'pending_approval');
  
  const handleCompleteMyTask = async (task: Task) => {
    try {
      await api.tasks.updateTask(task._id, { status: 'done' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete task');
    }
  };

  const approvalQueue = tasks.filter(t => t.status === 'pending_approval');
  const completedTasks = tasks.filter(t => t.status === 'done');
  
  // Calculate member workload
  const memberWorkload = members.map(m => {
    const activeTasks = tasks.filter(t => t.assigneeEmail === m.email && t.status !== 'done');
    const count = activeTasks.length;
    let statusText = `${count} active task${count !== 1 ? 's' : ''}`;
    let color = '#10b981';
    
    if (count === 0) {
      statusText = 'Available';
      color = '#3b82f6';
    } else if (count > 4) {
      statusText = 'At capacity';
      color = '#f43f5e';
    }

    return {
      ...m,
      taskCount: count,
      statusText,
      statusColor: color,
      indicator: color,
      avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name) + '&background=random'
    };
  });

  // Calculate velocity (mocked visual, based on actual done tasks if needed)
  const doneTasks = tasks.filter(t => t.status === 'done').length;

  if (loading && tasks.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#091426" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>EXECUTIVE OVERVIEW</Text>
          <Text style={styles.pageTitle}>Team Velocity Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreateModal(true)}>
            <Plus size={18} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Create Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainGrid}>
        {/* Left Column (Team Velocity) */}
        <View style={[styles.card, isLarge && { flex: 8, marginRight: 20 }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Team Velocity</Text>
              <Text style={styles.cardSubtitle}>Total completed tasks: {doneTasks}</Text>
            </View>
            <View style={styles.trendBadge}>
              <TrendingUp size={16} color="#065f46" />
              <Text style={styles.trendText}>Active</Text>
            </View>
          </View>
          
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 8, marginTop: 16 }}>
             <Text style={{color: '#9ca3af'}}>Velocity chart visualization</Text>
          </View>
        </View>

        {/* Right Column (Team Status) */}
        <View style={[styles.card, isLarge && { flex: 4, marginTop: 0 }, !isLarge && { marginTop: 20 }]}>
          <View style={[styles.cardHeader, { marginBottom: 16 }]}>
            <Text style={styles.cardTitle}>Team Status</Text>
            <TouchableOpacity>
              <Filter size={20} color="#45474c" />
            </TouchableOpacity>
          </View>

          <View style={styles.membersList}>
            {memberWorkload.map((member, idx) => (
              <View key={idx} style={styles.memberItem}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: member.avatar }} style={styles.avatarImg} />
                    <View style={[styles.statusDot, { backgroundColor: member.indicator }]} />
                  </View>
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={[styles.memberStatusText, { color: member.statusColor }]}>{member.statusText}</Text>
                  </View>
                </View>
                <TouchableOpacity>
                  <ClipboardCheck size={20} color="#45474c" />
                </TouchableOpacity>
              </View>
            ))}
            {memberWorkload.length === 0 && (
               <Text style={{color: '#6b7280', fontStyle: 'italic', padding: 10}}>No members found.</Text>
            )}
          </View>
        </View>
      </View>

      {/* My Active Tasks (for Team Lead) */}
      <View style={[styles.bottomSection, { marginTop: 32 }]}>
        <View style={styles.approvalHeader}>
          <View style={styles.approvalHeaderLeft}>
            <Text style={styles.cardTitle}>My Active Tasks</Text>
            <View style={[styles.queueBadge, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.queueBadgeText}>{myActiveTasks.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.queueGrid}>
          {myActiveTasks.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center', width: '100%' }}>
               <Text style={{ color: '#6b7280' }}>You have no active tasks.</Text>
            </View>
          ) : myActiveTasks.map((item, idx) => (
            <View key={idx} style={[styles.approvalCard, isMedium && { flex: 1, minWidth: '30%', maxWidth: '33%' }, !isMedium && { width: '100%' }]}>
              <View style={styles.approvalCardTop}>
                <View style={[styles.actionRequiredBadge, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[styles.actionRequiredText, { color: '#1e40af' }]}>YOUR TASK</Text>
                </View>
                <MoreVertical size={18} color="#45474c" />
              </View>
              <Text style={styles.approvalTaskTitle} numberOfLines={2}>{item.title}</Text>
              
              <View style={styles.submittedByRow}>
                <Text style={styles.submittedByText}>
                  Priority: <Text style={{ color: '#091426', fontWeight: '500', textTransform: 'capitalize' }}>{item.priority}</Text>
                </Text>
              </View>

              <View style={styles.approvalActions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleCompleteMyTask(item)}>
                  <Text style={styles.approveBtnText}>Mark Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Area (Approval Queue) */}
      <View style={styles.bottomSection}>
        <View style={styles.approvalHeader}>
          <View style={styles.approvalHeaderLeft}>
            <Text style={styles.cardTitle}>Approval Queue</Text>
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeText}>{approvalQueue.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.queueGrid}>
          {approvalQueue.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center', width: '100%' }}>
               <Text style={{ color: '#6b7280' }}>No tasks pending approval.</Text>
            </View>
          ) : approvalQueue.map((item, idx) => (
            <View key={idx} style={[styles.approvalCard, isMedium && { flex: 1, minWidth: '30%', maxWidth: '33%' }, !isMedium && { width: '100%' }]}>
              <View style={styles.approvalCardTop}>
                <View style={styles.actionRequiredBadge}>
                  <Text style={styles.actionRequiredText}>ACTION REQUIRED</Text>
                </View>
                <MoreVertical size={18} color="#45474c" />
              </View>
              <Text style={styles.approvalTaskTitle} numberOfLines={2}>{item.title}</Text>
              
              <View style={styles.submittedByRow}>
                <Text style={styles.submittedByText}>
                  Submitted by <Text style={{ color: '#091426', fontWeight: '500' }}>{item.assigneeName || item.assigneeEmail || 'Unknown'}</Text>
                </Text>
              </View>

              <View style={styles.approvalActions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reassignBtn} onPress={() => { setSelectedTask(item); setShowFeedbackModal(true); }}>
                  <Text style={styles.reassignBtnText}>Return</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Completed Tasks Section */}
      <View style={[styles.bottomSection, { marginTop: 32 }]}>
        <TouchableOpacity style={styles.approvalHeader} onPress={() => setShowCompleted(v => !v)} activeOpacity={0.8}>
          <View style={styles.approvalHeaderLeft}>
            <Text style={styles.cardTitle}>Completed Tasks</Text>
            <View style={[styles.queueBadge, { backgroundColor: '#10b981' }]}>
              <Text style={styles.queueBadgeText}>{completedTasks.length}</Text>
            </View>
          </View>
          <Text style={{ color: '#6b7280', fontSize: 14 }}>{showCompleted ? 'Hide ▲' : 'Show ▼'}</Text>
        </TouchableOpacity>

        {showCompleted && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {completedTasks.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#6b7280' }}>No completed tasks yet.</Text>
              </View>
            ) : completedTasks.map((task, idx) => (
              <View key={idx} style={styles.completedTaskRow}>
                <View style={styles.completedCheck}>
                  <Check size={14} color="#ffffff" strokeWidth={3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedTaskTitle}>{task.title}</Text>
                  <Text style={styles.completedTaskMeta}>
                    {task.assigneeName || task.assigneeEmail || 'Unassigned'}
                    {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View style={styles.doneBadge}>
                  <Text style={styles.doneBadgeText}>Done</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Modals */}
      {/* Create Task Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Task</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Task Title"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Description (optional)"
              multiline
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
            />

            <Text style={styles.label}>Assign To</Text>
            <View style={styles.assigneeList}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {members.map(m => (
                  <TouchableOpacity 
                    key={m.email} 
                    style={[styles.assigneePill, newTaskAssignee === m.email && styles.assigneePillSelected]}
                    onPress={() => setNewTaskAssignee(m.email)}
                  >
                    <Text style={[styles.assigneePillText, newTaskAssignee === m.email && styles.assigneePillTextSelected]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.label}>Deadline</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD  (e.g. 2025-06-15)"
              placeholderTextColor="#9ca3af"
              value={newTaskDueDate}
              onChangeText={text => setNewTaskDueDate(text)}
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreateTask}>
              <Text style={styles.modalSubmitBtnText}>Create Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={showFeedbackModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Return Task</Text>
              <TouchableOpacity onPress={() => { setShowFeedbackModal(false); setFeedbackText(''); }}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ marginBottom: 12, color: '#4b5563' }}>
              Provide feedback on what needs to be changed for "{selectedTask?.title}":
            </Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Add your comments here..."
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRejectSubmit}>
              <Text style={styles.modalSubmitBtnText}>Return to Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const getStyles = (width: number, isLarge: boolean, isMedium: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  content: { padding: isMedium ? 32 : 16, paddingBottom: 80 },
  headerRow: { flexDirection: isMedium ? 'row' : 'column', alignItems: isMedium ? 'flex-end' : 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 },
  headerLeft: {},
  eyebrow: { fontSize: 12, fontWeight: '600', color: '#54647a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  pageTitle: { fontSize: 32, fontWeight: '600', color: '#091426', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#091426', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  mainGrid: { flexDirection: isLarge ? 'row' : 'column', marginBottom: 32 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderColor: '#e6e8ea', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#091426', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#54647a' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  trendText: { color: '#065f46', fontSize: 12, fontWeight: '600' },
  membersList: { gap: 16 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrapper: { position: 'relative' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#ffffff' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#091426' },
  memberStatusText: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  bottomSection: { gap: 16 },
  approvalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  approvalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  queueBadge: { backgroundColor: '#f43f5e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  queueBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  queueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  approvalCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, borderColor: '#e6e8ea', borderWidth: 1 },
  approvalCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actionRequiredBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actionRequiredText: { fontSize: 10, fontWeight: '700', color: '#b91c1c', letterSpacing: 0.5 },
  approvalTaskTitle: { fontSize: 16, fontWeight: '600', color: '#091426', lineHeight: 22, marginBottom: 16 },
  submittedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  submittedByText: { fontSize: 13, color: '#54647a' },
  approvalActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1, backgroundColor: '#091426', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  approveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  reassignBtn: { flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  reassignBtnText: { color: '#4b5563', fontSize: 14, fontWeight: '500' },
  completedTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderRadius: 8, padding: 14, borderColor: '#e6e8ea', borderWidth: 1 },
  completedCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  completedTaskTitle: { fontSize: 14, fontWeight: '500', color: '#374151', textDecorationLine: 'line-through' },
  completedTaskMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  doneBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  doneBadgeText: { fontSize: 12, fontWeight: '600', color: '#065f46' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 16, color: '#111827' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  assigneeList: { marginBottom: 24, flexDirection: 'row' },
  assigneePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  assigneePillSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  assigneePillText: { fontSize: 14, color: '#4b5563' },
  assigneePillTextSelected: { color: '#2563eb', fontWeight: '500' },
  modalSubmitBtn: { backgroundColor: '#091426', padding: 14, borderRadius: 8, alignItems: 'center' },
  modalSubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
