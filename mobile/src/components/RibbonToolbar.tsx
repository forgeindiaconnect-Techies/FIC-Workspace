import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export type RibbonGroup = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export type RibbonTab = {
  id: string;
  label: string;
  groups: RibbonGroup[];
};

type RibbonToolbarProps = {
  tabs: RibbonTab[];
};

export default function RibbonToolbar({ tabs }: RibbonToolbarProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  const activeContent = tabs.find(t => t.id === activeTab)?.groups || [];

  return (
    <View style={styles.container}>
      {/* Top Tabs (File, Home, Insert, etc) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabList}>
        <TouchableOpacity style={styles.fileTabButton}>
          <Text style={styles.fileTabText}>File</Text>
        </TouchableOpacity>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ribbon Content Area */}
      <View style={styles.contentArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsContainer}>
          {activeContent.map((group, index) => (
            <View key={group.id} style={styles.groupWrapper}>
              <View style={styles.groupContent}>
                {group.content}
              </View>
              <Text style={styles.groupLabel}>{group.label}</Text>
              
              {/* Vertical divider after each group except the last */}
              {index < activeContent.length - 1 && (
                <View style={styles.groupDivider} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F2F1', // Word-like gray ribbon background
    borderBottomWidth: 1,
    borderBottomColor: '#D2D0CE',
  },
  tabList: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    backgroundColor: '#FFFFFF', // Tabs are usually on white background
    borderBottomWidth: 1,
    borderBottomColor: '#E1DFDD',
  },
  fileTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#2b579a', // Word blue
  },
  fileTabText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#2b579a',
  },
  tabText: {
    fontSize: 13,
    color: '#605E5C',
    fontWeight: '400',
  },
  activeTabText: {
    color: '#2b579a',
    fontWeight: '600',
  },
  contentArea: {
    backgroundColor: '#F3F2F1',
    height: 80, // Fixed height for ribbon
    justifyContent: 'center',
  },
  groupsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    position: 'relative',
  },
  groupContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    height: 52, // Space for tools
  },
  groupLabel: {
    fontSize: 11,
    color: '#605E5C',
    textAlign: 'center',
    marginTop: 2,
  },
  groupDivider: {
    position: 'absolute',
    right: 0,
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: '#C8C6C4',
  }
});
