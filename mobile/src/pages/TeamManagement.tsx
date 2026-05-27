import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions, Platform, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Users, Plus, Shield, Mail, Lock, User as UserIcon, X, Check } from 'lucide-react-native';
import { api, getSession } from '../lib/api';
import { User } from '../types';

export default function TeamManagement() {
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024;
  const isMedium = width >= 768;

  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Member'>('Member');
  const [submitting, setSubmitting] = useState(false);

  const styles = React.useMemo(() => getStyles(width, isLarge, isMedium), [width, isLarge, isMedium]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { user } = getSession();
      const workspace = user?.workspaceId || 'antigraviity-hq';
      const data = await api.members.getMembers(workspace);
      
      // Handle both cases: if data is an array, or if data is an object like { members: [...] }
      const membersArray = Array.isArray(data) ? data : (Array.isArray(data?.members) ? data.members : []);
      setMembers(membersArray);
    } catch (err: any) {
      setError(err.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleAddMember = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Error', 'Name, email, and password are required.');
      return;
    }

    try {
      setSubmitting(true);
      const { user } = getSession();
      const workspace = user?.workspaceId || 'antigraviity-hq';
      
      await api.members.addMember({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        workspaceId: workspace
      });

      // Reset form and reload list
      setShowAddForm(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('Member');
      loadMembers();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAddForm = () => {
    if (!showAddForm) return null;

    return (
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Add New Team Member</Text>
          <TouchableOpacity onPress={() => setShowAddForm(false)}>
            <X size={20} color="#45474c" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <UserIcon size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. David Chen"
              placeholderTextColor="#94a3b8"
              value={newName}
              onChangeText={setNewName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <Mail size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="david@company.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Temporary Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>
        </View>

        <View style={styles.roleGroup}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity 
              style={[styles.roleBtn, newRole === 'Member' && styles.roleBtnActive]}
              onPress={() => setNewRole('Member')}
            >
              <Text style={[styles.roleBtnText, newRole === 'Member' && styles.roleBtnTextActive]}>Member</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleBtn, newRole === 'Admin' && styles.roleBtnActive]}
              onPress={() => setNewRole('Admin')}
            >
              <Text style={[styles.roleBtnText, newRole === 'Admin' && styles.roleBtnTextActive]}>Admin</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleAddMember}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>WORKSPACE ADMINISTRATION</Text>
          <Text style={styles.pageTitle}>Team Management</Text>
        </View>
        <View style={styles.headerRight}>
          {!showAddForm && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAddForm(true)}>
              <Plus size={18} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Add Member</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderAddForm()}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Directory</Text>
            <Text style={styles.cardSubtitle}>Manage access and credentials for your team</Text>
          </View>
          <View style={styles.badge}>
            <Users size={16} color="#0f172a" />
            <Text style={styles.badgeText}>{members.length} members</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingPane}>
            <ActivityIndicator size="large" color="#091426" />
          </View>
        ) : error ? (
          <View style={styles.errorPane}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Image source={{ uri: member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}` }} style={styles.avatar} />
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                </View>
                
                <View style={styles.memberMeta}>
                  {member.role === 'Admin' && (
                    <View style={styles.roleBadgeAdmin}>
                      <Shield size={12} color="#92400e" />
                      <Text style={styles.roleTextAdmin}>Admin</Text>
                    </View>
                  )}
                  {member.role === 'Member' && (
                    <View style={styles.roleBadgeMember}>
                      <Text style={styles.roleTextMember}>Member</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (width: number, isLarge: boolean, isMedium: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  content: {
    padding: isMedium ? 32 : 16,
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: isMedium ? 'row' : 'column',
    alignItems: isMedium ? 'flex-end' : 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
  },
  headerLeft: {},
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#54647a',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#091426',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#091426',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#091426',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  loadingPane: {
    padding: 40,
    alignItems: 'center',
  },
  errorPane: {
    padding: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  list: {
    gap: 0,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadgeAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTextAdmin: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  roleBadgeMember: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleTextMember: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  roleGroup: {
    marginBottom: 24,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  roleBtnActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  roleBtnTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});
