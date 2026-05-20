import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import { Plus, MoreHorizontal, Clock, Filter } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const columns = [
  { id: 'todo', title: 'To Do', color: '#94a3b8' },
  { id: 'in-progress', title: 'Running', color: '#2563eb' },
  { id: 'done', title: 'Done', color: '#10b981' }
];

const initialTasks = [
  { id: 1, title: 'Finalize UI Components for V2', status: 'in-progress', priority: 'high', assignee: 'JD' },
  { id: 2, title: 'Database Migration Strategy', status: 'todo', priority: 'high', assignee: 'AM' },
  { id: 3, title: 'Security Audit & E2E Tests', status: 'todo', priority: 'medium', assignee: 'JD' },
  { id: 5, title: 'Bug Squash: Login Layout', status: 'done', priority: 'high', assignee: 'JD' },
];

export default function Tasks() {
  return (
    <View style={styles.container}>
      {/* Task Header */}
      <View style={styles.header}>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Board</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>Timeline</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={18} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newButton}>
            <Plus size={20} color="#fff" />
            <Text style={styles.newButtonText}>New Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Task Board */}
      <ScrollView 
        horizontal 
        style={styles.board} 
        contentContainerStyle={styles.boardContent}
        showsHorizontalScrollIndicator={false}
      >
        {columns.map((column) => (
          <View key={column.id} style={styles.column}>
            <View style={styles.columnHeader}>
              <View style={styles.columnTitleContainer}>
                <View style={[styles.dot, { backgroundColor: column.color }]} />
                <Text style={styles.columnTitle}>{column.title}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {initialTasks.filter(t => t.status === column.id).length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity>
                <MoreHorizontal size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.taskList} contentContainerStyle={styles.taskListContent}>
              {initialTasks.filter(t => t.status === column.id).map((task) => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskHeader}>
                    <View style={[styles.priorityBadge, task.priority === 'high' ? styles.priorityHigh : styles.priorityMed]}>
                      <Text style={[styles.priorityText, task.priority === 'high' ? styles.textHigh : styles.textMed]}>
                        {task.priority}
                      </Text>
                    </View>
                    <TouchableOpacity>
                      <MoreHorizontal size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View style={styles.taskFooter}>
                    <View style={styles.dateContainer}>
                      <Clock size={12} color="#94a3b8" />
                      <Text style={styles.dateText}>Aug 24</Text>
                    </View>
                    <View style={styles.assignee}>
                      <Text style={styles.assigneeText}>{task.assignee}</Text>
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addCardButton}>
                <Plus size={16} color="#94a3b8" />
                <Text style={styles.addCardText}>Add Card</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    padding: 24,
    borderRadius: 40,
    gap: 16,
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
  priorityHigh: {
    backgroundColor: '#fef2f2',
  },
  priorityMed: {
    backgroundColor: '#f8fafc',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textHigh: {
    color: '#ef4444',
  },
  textMed: {
    color: '#64748b',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: 22,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  assignee: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
  },
  addCardButton: {
    width: '100%',
    padding: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 40,
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
});
