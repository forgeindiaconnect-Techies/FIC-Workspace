import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Platform } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

export interface DropdownItem {
  label: string;
  value: string;
  style?: any;
}

interface RibbonDropdownProps {
  items: DropdownItem[];
  value: string;
  onChange: (value: string) => void;
  width?: number;
  placeholder?: string;
}

export default function RibbonDropdown({ items, value, onChange, width = 120, placeholder }: RibbonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedItem = items.find(item => item.value === value);

  return (
    <View style={[styles.container, { width }]}>
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.buttonText} numberOfLines={1}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <ChevronDown size={14} color="#64748b" />
      </TouchableOpacity>

      {isOpen && (
        <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setIsOpen(false)}
          >
            <View style={styles.dropdownMenu}>
              <FlatList
                data={items}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.menuItem, item.value === value && styles.activeMenuItem]}
                    onPress={() => {
                      onChange(item.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[styles.menuItemText, item.style]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    height: 32,
  },
  buttonText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 200,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    ...Platform.select({
      web: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    })
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activeMenuItem: {
    backgroundColor: '#f8fafc',
  },
  menuItemText: {
    fontSize: 14,
    color: '#334155',
  }
});
