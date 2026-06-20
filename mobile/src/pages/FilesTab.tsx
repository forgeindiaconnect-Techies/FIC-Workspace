import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import tw from 'twrnc';
import { api, getSession } from '../lib/api';
import { FolderGit2, GitBranch, Rocket, BookOpen, Workflow, KeyRound, Plus, X, Search, ChevronRight, MoreVertical, Trash2 } from 'lucide-react-native';

const STATUS_BADGES: Record<string, { label: string, color: string, bg: string }> = {
  active: { label: 'Active', color: '#10b981', bg: '#ecfdf5' },
  completed: { label: 'Completed', color: '#3b82f6', bg: '#eff6ff' },
  on_hold: { label: 'On Hold', color: '#f59e0b', bg: '#fffbeb' },
  archived: { label: 'Archived', color: '#6b7280', bg: '#f9fafb' },
};

export default function FilesTab() {
  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [workspaceId]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await api.projects.getProjects(workspaceId, 'all');
      setProjects(data);
    } catch (err) {
      console.warn('Failed to fetch projects', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsSubmitting(true);
    try {
      await api.projects.createProject({
        workspaceId,
        name: newProjectName,
        description: newProjectDesc,
        icon: '📁',
        color: '#2170E4',
        tags: []
      });
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      fetchProjects();
    } catch (e) {
      Alert.alert('Error', 'Could not create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    Alert.alert('Delete Project', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.projects.deleteProject(id);
          fetchProjects();
        } catch {}
      }}
    ]);
  };

  const filteredProjects = projects.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={tw`flex-1 bg-[#F5F7FB]`}>
      <View style={tw`bg-white px-4 py-4 border-b border-gray-200 flex-row justify-between items-center`}>
        <View style={tw`flex-1 mr-3 relative justify-center`}>
          <Search size={18} color="#9ca3af" style={tw`absolute left-3 z-10`} />
          <TextInput
            placeholder="Search projects..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={tw`bg-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-[14px]`}
          />
        </View>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={tw`bg-[#2170E4] p-2.5 rounded-xl`}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 p-4`} contentContainerStyle={tw`pb-24`}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2170E4" style={tw`mt-10`} />
        ) : filteredProjects.length === 0 ? (
          <View style={tw`items-center justify-center mt-20`}>
            <FolderGit2 size={48} color="#cbd5e1" />
            <Text style={tw`text-gray-500 font-bold text-lg mt-4`}>No projects found</Text>
          </View>
        ) : (
          filteredProjects.map(project => {
            const badge = STATUS_BADGES[project.status] || STATUS_BADGES.active;
            const itemsCount = (project.gitRepos?.length || 0) + (project.deployments?.length || 0) + (project.documentation?.length || 0);
            
            return (
              <View key={project._id} style={tw`bg-white p-4 rounded-2xl mb-4 border border-gray-100 shadow-sm`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                  <View style={tw`flex-row items-center gap-3 flex-1`}>
                    <View style={tw`w-12 h-12 rounded-xl items-center justify-center`} style={[tw`w-12 h-12 rounded-xl items-center justify-center`, { backgroundColor: `${project.color || '#2170E4'}15` }]}>
                      <Text style={tw`text-2xl`}>{project.icon || '📁'}</Text>
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`font-bold text-[16px] text-[#0B1C30]`}>{project.name}</Text>
                      <View style={[tw`self-start px-2 py-0.5 rounded-full mt-1`, { backgroundColor: badge.bg }]}>
                        <Text style={[tw`text-[10px] font-bold`, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteProject(project._id)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                
                {project.description ? (
                  <Text style={tw`text-gray-500 text-[13px] mb-4`}>{project.description}</Text>
                ) : null}

                <View style={tw`flex-row flex-wrap gap-2 pt-3 border-t border-gray-100`}>
                  <View style={tw`flex-row items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg`}>
                    <GitBranch size={14} color="#4b5563" />
                    <Text style={tw`text-xs text-gray-600`}>{project.gitRepos?.length || 0}</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg`}>
                    <Rocket size={14} color="#4b5563" />
                    <Text style={tw`text-xs text-gray-600`}>{project.deployments?.length || 0}</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg`}>
                    <BookOpen size={14} color="#4b5563" />
                    <Text style={tw`text-xs text-gray-600`}>{project.documentation?.length || 0}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Project Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 h-[70%]`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <Text style={tw`font-bold text-lg text-[#0B1C30]`}>New Project</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}><X size={24} color="#000" /></TouchableOpacity>
            </View>
            
            <View style={tw`mb-4`}>
              <Text style={tw`text-[13px] font-semibold text-gray-600 mb-1.5`}>Project Name</Text>
              <TextInput
                style={tw`border border-gray-200 rounded-xl px-4 py-3 text-[14px]`}
                placeholder="e.g. Mobile App Redesign"
                value={newProjectName}
                onChangeText={setNewProjectName}
              />
            </View>
            
            <View style={tw`mb-6`}>
              <Text style={tw`text-[13px] font-semibold text-gray-600 mb-1.5`}>Description (Optional)</Text>
              <TextInput
                style={tw`border border-gray-200 rounded-xl px-4 py-3 h-24 text-[14px]`}
                placeholder="What is this project about?"
                multiline
                value={newProjectDesc}
                onChangeText={setNewProjectDesc}
              />
            </View>
            
            <TouchableOpacity 
              onPress={handleCreateProject}
              disabled={isSubmitting || !newProjectName.trim()}
              style={tw`bg-[#2170E4] py-3.5 rounded-xl items-center opacity-${(isSubmitting || !newProjectName.trim()) ? '50' : '100'}`}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={tw`text-white font-bold text-[15px]`}>Create Project</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
