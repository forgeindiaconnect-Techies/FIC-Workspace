import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, useWindowDimensions, ActivityIndicator, Alert } from 'react-native';
import { Filter, Calendar, Flag, Zap, Clock, Check, MoreVertical, Plus, AlertCircle, Send } from 'lucide-react-native';
import { api, getSession } from '../lib/api';
import { Task } from '../types';

export default function MemberTasksDashboard() {
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024;
  const isMedium = width >= 768;

  const styles = useMemo(() => getStyles(width, isLarge, isMedium), [width, isLarge, isMedium]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskInput, setNewTaskInput] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const { user } = getSession();
      const workspaceId = user?.workspaceId || 'antigraviity-hq';
      
      const fetchedTasks = await api.tasks.getTasks(workspaceId);
      
      // Filter tasks assigned to the current user
      const myTasks = (fetchedTasks || []).filter((t: Task) => t.assigneeEmail === user?.email);
      setTasks(myTasks);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleTask = async (task: Task) => {
    if (task.status === 'done') return; // already approved
    if (task.status === 'pending_approval') {
      Alert.alert('Pending Approval', 'This task is waiting for the Team Lead to approve.');
      return;
    }

    try {
      await api.tasks.updateTask(task._id, { status: 'pending_approval' });
      loadData();
      Alert.alert('Success', 'Task submitted for approval!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task');
    }
  };

  const handleRapidAdd = async () => {
    if (!newTaskInput.trim()) return;

    try {
      const { user } = getSession();
      const workspaceId = user?.workspaceId || 'antigraviity-hq';

      await api.tasks.createTask({
        workspaceId,
        title: newTaskInput.trim(),
        status: 'todo',
        priority: 'medium',
        assigneeEmail: user?.email,
        assigneeName: user?.name,
      });

      setNewTaskInput('');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task');
    }
  };

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  if (loading && tasks.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#091426" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.gridContainer}>
        {/* Left Column (Focus Dashboard) */}
        <View style={[styles.leftColumn, isMedium && { flex: 5 }, isLarge && { flex: 4 }]}>
          
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <Text style={styles.eyebrow}>MY DAY</Text>
              <Text style={styles.focusTitle}>Focused Progress</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>{doneCount} of {totalCount} tasks approved</Text>
                <Text style={styles.progressPercent}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.spotlightCard} activeOpacity={0.95}>
            <Text style={styles.spotlightBgIcon}>!</Text>
            <View style={styles.spotlightContent}>
              <View style={styles.spotlightHeader}>
                <Zap size={16} color="#ffffff" fill="#ffffff" />
                <Text style={styles.spotlightEyebrow}>NEXT PRIORITY</Text>
              </View>
              <Text style={styles.spotlightTitle}>Maintain High Productivity</Text>
              <View style={styles.spotlightFooter}>
                <View style={styles.spotlightBadge}>
                  <Clock size={14} color="#ffffff" />
                  <Text style={styles.spotlightBadgeText}>Check your backlog below</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

        </View>

        {/* Right Column (Task Backlog) */}
        <View style={[styles.rightColumn, isMedium && { flex: 7 }, isLarge && { flex: 8 }]}>
          
          <View style={styles.backlogHeader}>
            <Text style={styles.backlogTitle}>Active Backlog</Text>
            <TouchableOpacity style={styles.filterBtn}>
              <Filter size={16} color="#091426" />
              <Text style={styles.filterBtnText}>Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.taskList}>
            {tasks.length === 0 ? (
               <Text style={{ color: '#6b7280', marginTop: 16 }}>No tasks assigned yet.</Text>
            ) : tasks.map(task => {
              const isDone = task.status === 'done';
              const isPending = task.status === 'pending_approval';
              const hasFeedback = task.feedback && task.status === 'in-progress';
              
              let priorityBg = 'transparent';
              let priorityColor = '#45474c';
              if (task.priority === 'high') { priorityBg = '#ba1a1a1a'; priorityColor = '#ba1a1a'; }
              else if (task.priority === 'medium') { priorityBg = '#f59e0b1a'; priorityColor = '#b45309'; }

              return (
                <View key={task._id} style={[styles.taskCard, isDone && styles.taskCardCompleted, isPending && styles.taskCardPending]}>
                  <TouchableOpacity 
                    style={[styles.checkbox, (isDone || isPending) && styles.checkboxChecked, isPending && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}
                    onPress={() => handleToggleTask(task)}
                  >
                    {(isDone || isPending) && <Check size={14} color="#ffffff" strokeWidth={3} />}
                  </TouchableOpacity>
                  
                  <View style={styles.taskContent}>
                    <View style={styles.taskTitleRow}>
                      <Text style={[styles.taskTitle, isDone && styles.taskTitleCompleted]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      {!isDone && task.priority ? (
                        <View style={[styles.priorityBadge, { backgroundColor: priorityBg }]}>
                          <Text style={[styles.priorityText, { color: priorityColor }]}>{task.priority.toUpperCase()}</Text>
                        </View>
                      ) : null}
                      {isPending && (
                         <View style={[styles.priorityBadge, { backgroundColor: '#fef3c7' }]}>
                           <Text style={[styles.priorityText, { color: '#d97706' }]}>WAITING APPROVAL</Text>
                         </View>
                      )}
                    </View>
                    
                    <View style={styles.taskMetaRow}>
                      {!isDone && <Calendar size={12} color="#45474c" />}
                      <Text style={styles.taskMetaText}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</Text>
                    </View>

                    {/* Feedback Alert if task was rejected */}
                    {hasFeedback && (
                      <View style={styles.feedbackContainer}>
                        <AlertCircle size={14} color="#b91c1c" style={{ marginTop: 2 }} />
                        <View>
                          <Text style={styles.feedbackTitle}>Returned by Team Lead:</Text>
                          <Text style={styles.feedbackText}>{task.feedback}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  
                  {!isDone && !isPending && (
                    <TouchableOpacity style={styles.dragHandle}>
                      <MoreVertical size={20} color="#c5c6cd" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.rapidEntryContainer}>
            <View style={styles.inputWrapper}>
              <Plus size={20} color="#45474c" style={styles.inputIconLeft} />
              <TextInput 
                style={styles.rapidInput} 
                placeholder="Add a task for yourself..."
                placeholderTextColor="#45474c"
                value={newTaskInput}
                onChangeText={setNewTaskInput}
                onSubmitEditing={handleRapidAdd}
              />
              <TouchableOpacity style={styles.inputActionsRight} onPress={handleRapidAdd}>
                <Send size={18} color="#091426" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHelperText}>Press Enter to save task instantly.</Text>
          </View>

        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (width: number, isLarge: boolean, isMedium: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  content: { padding: isMedium ? 32 : 16, paddingBottom: 80 },
  gridContainer: { flexDirection: isMedium ? 'row' : 'column', gap: 24 },
  leftColumn: { gap: 24 },
  rightColumn: { gap: 16 },
  focusCard: { backgroundColor: '#ffffff', borderColor: '#c5c6cd', borderWidth: 1, borderRadius: 12, padding: 24, gap: 16 },
  focusHeader: { gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '600', color: '#45474c', textTransform: 'uppercase', letterSpacing: 1 },
  focusTitle: { fontSize: isMedium ? 32 : 24, fontWeight: '600', color: '#091426', letterSpacing: -0.5 },
  progressContainer: { gap: 8 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressLabel: { fontSize: 14, color: '#45474c' },
  progressPercent: { fontSize: 14, fontWeight: '500', color: '#091426' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#eceef0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#091426', borderRadius: 4 },
  spotlightCard: { backgroundColor: '#091426', borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  spotlightBgIcon: { position: 'absolute', top: -20, right: 10, fontSize: 120, color: 'rgba(255,255,255,0.05)', fontWeight: '900', fontFamily: 'serif' },
  spotlightContent: { zIndex: 10, gap: 16 },
  spotlightHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotlightEyebrow: { fontSize: 12, fontWeight: '600', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 },
  spotlightTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', lineHeight: 28 },
  spotlightFooter: { flexDirection: 'row', alignItems: 'center' },
  spotlightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  spotlightBadgeText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  backlogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backlogTitle: { fontSize: 20, fontWeight: '600', color: '#191c1e' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterBtnText: { fontSize: 14, fontWeight: '500', color: '#091426' },
  taskList: { gap: 8 },
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, backgroundColor: '#ffffff', borderColor: '#c5c6cd', borderWidth: 1, padding: 16, borderRadius: 8 },
  taskCardCompleted: { backgroundColor: '#eceef0', borderColor: 'rgba(197,198,205,0.3)', opacity: 0.6 },
  taskCardPending: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#75777d', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: '#091426', borderColor: '#091426' },
  taskContent: { flex: 1 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#091426' },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#191c1e' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  taskMetaText: { fontSize: 12, color: '#45474c' },
  feedbackContainer: { marginTop: 12, padding: 12, backgroundColor: '#fef2f2', borderRadius: 6, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#fecaca' },
  feedbackTitle: { fontSize: 12, fontWeight: '700', color: '#991b1b', marginBottom: 2 },
  feedbackText: { fontSize: 13, color: '#b91c1c' },
  dragHandle: { padding: 4, marginTop: 2 },
  rapidEntryContainer: { marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#c5c6cd' },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  inputIconLeft: { position: 'absolute', left: 16, zIndex: 10 },
  rapidInput: { backgroundColor: '#f2f4f6', borderColor: '#c5c6cd', borderWidth: 1, borderRadius: 8, paddingVertical: 16, paddingLeft: 48, paddingRight: 60, fontSize: 14, color: '#191c1e' },
  inputActionsRight: { position: 'absolute', right: 16, padding: 8, backgroundColor: '#e2e8f0', borderRadius: 6, zIndex: 10 },
  inputHelperText: { fontSize: 12, color: '#45474c', marginTop: 8, paddingHorizontal: 16 }
});
