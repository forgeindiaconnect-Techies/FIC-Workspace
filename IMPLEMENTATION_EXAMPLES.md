# Implementation Examples for Page Components

This file provides code examples for implementing responsive design in your page components.

## Example 1: Home Component (Simple)

```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useResponsiveLayout } from '../lib/responsive';

export default function Home() {
  const { screenType, contentPadding, width } = useResponsiveLayout();
  
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: contentPadding.horizontal,
      paddingVertical: contentPadding.vertical,
    },
    title: {
      fontSize: screenType === 'small' ? 24 : 28,
      fontWeight: '800',
      marginBottom: 16,
    },
  }), [contentPadding, screenType]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Welcome Home</Text>
      {/* Your content */}
    </ScrollView>
  );
}
```

## Example 2: Meetings Component (With Grid)

```typescript
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  useWindowDimensions,
  Dimensions 
} from 'react-native';
import { useResponsiveLayout } from '../lib/responsive';
import { getScreenType, getGridColumns } from '../lib/responsive';

export default function Meetings() {
  const { width, height } = useWindowDimensions();
  const screenType = getScreenType(width);
  const gridColumns = getGridColumns(screenType);
  
  const { contentPadding } = useResponsiveLayout();
  
  const styles = React.useMemo(() => {
    const itemWidth = (width - (contentPadding.horizontal * 2) - (16 * (gridColumns - 1))) / gridColumns;
    
    return StyleSheet.create({
      container: {
        flex: 1,
        paddingHorizontal: contentPadding.horizontal,
        paddingVertical: contentPadding.vertical,
      },
      grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
      },
      gridItem: {
        width: itemWidth,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
      },
    });
  }, [width, contentPadding, gridColumns, screenType]);

  const mockItems = Array(6).fill(null).map((_, i) => ({
    id: i,
    title: `Meeting ${i + 1}`
  }));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {mockItems.map(item => (
          <View key={item.id} style={styles.gridItem}>
            <Text>{item.title}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

## Example 3: Component with Responsive Conditional Rendering

```typescript
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  useWindowDimensions 
} from 'react-native';
import { useResponsiveLayout } from '../lib/responsive';

export default function Chat() {
  const { screenType, contentPadding, isSmallScreen, isTabletScreen } = useResponsiveLayout();
  
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: contentPadding.horizontal,
      paddingVertical: contentPadding.vertical,
    },
    // Small screen layout (compact)
    ...(isSmallScreen && {
      messageList: {
        marginBottom: 12,
      },
      messageBubble: {
        maxWidth: '90%',
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
    }),
    // Tablet layout (expanded)
    ...(isTabletScreen && {
      messageList: {
        marginBottom: 24,
        maxWidth: 600,
        alignSelf: 'center',
      },
      messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
      },
    }),
  }), [contentPadding, isSmallScreen, isTabletScreen]);

  return (
    <ScrollView style={styles.container}>
      {/* Render different layouts based on screen size */}
      {isSmallScreen && <CompactChatView styles={styles} />}
      {!isSmallScreen && !isTabletScreen && <StandardChatView styles={styles} />}
      {isTabletScreen && <TabletChatView styles={styles} />}
    </ScrollView>
  );
}

function CompactChatView({ styles }: any) {
  return (
    <View>
      <Text>Compact chat view for small screens</Text>
    </View>
  );
}

function StandardChatView({ styles }: any) {
  return (
    <View>
      <Text>Standard chat view</Text>
    </View>
  );
}

function TabletChatView({ styles }: any) {
  return (
    <View>
      <Text>Tablet chat view with expanded layout</Text>
    </View>
  );
}
```

## Example 4: Handling Modals Responsively

```typescript
import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions 
} from 'react-native';
import { getScreenType, getContentPadding } from '../lib/responsive';

export default function TasksWithModal() {
  const { width } = useWindowDimensions();
  const screenType = getScreenType(width);
  const padding = getContentPadding(screenType, width);
  
  const [showModal, setShowModal] = React.useState(false);
  
  const styles = React.useMemo(() => {
    const modalWidth = screenType === 'small' 
      ? Math.min(width - 32, 300)
      : screenType === 'tablet'
      ? Math.min(width * 0.6, 500)
      : Math.min(width * 0.5, 600);
      
    return StyleSheet.create({
      container: {
        flex: 1,
        paddingHorizontal: padding.horizontal,
      },
      modal: {
        width: modalWidth,
        alignSelf: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: padding.horizontal,
        marginTop: 100,
      },
    });
  }, [screenType, width, padding]);

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)}>
        <Text>Open Modal</Text>
      </TouchableOpacity>
      
      <Modal visible={showModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={styles.modal}>
            <Text>Modal Content</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
```

## Example 5: Responsive List Component

```typescript
import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity 
} from 'react-native';
import { useResponsiveLayout } from '../lib/responsive';

interface ListItem {
  id: string;
  title: string;
  description: string;
}

export default function ResponsiveList({ items }: { items: ListItem[] }) {
  const { screenType, contentPadding, isSmallScreen } = useResponsiveLayout();
  
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: contentPadding.horizontal,
      paddingVertical: contentPadding.vertical,
    },
    listItem: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: isSmallScreen ? 12 : 16,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    itemDesc: {
      fontSize: isSmallScreen ? 12 : 13,
      color: '#666',
    },
  }), [contentPadding, isSmallScreen, screenType]);

  const renderItem = ({ item }: { item: ListItem }) => (
    <TouchableOpacity style={styles.listItem}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemDesc}>{item.description}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.container}
      scrollEnabled={true}
    />
  );
}
```

## Key Principles

1. **Always use `useWindowDimensions()`** for reactive updates
2. **Wrap style calculations in `useMemo()`** to prevent unnecessary recalculations
3. **Use responsive functions** instead of hardcoding values
4. **Test on multiple screen sizes** before committing
5. **Consider all 5 screen types** in your design
6. **Use conditional rendering** for significantly different layouts

## Common Patterns

### Pattern 1: Responsive Font Sizes
```typescript
fontSize: isSmallScreen ? 14 : 16
```

### Pattern 2: Responsive Spacing
```typescript
marginBottom: contentPadding.vertical
```

### Pattern 3: Responsive Dimensions
```typescript
width: screenType === 'tablet' ? '50%' : '100%'
```

### Pattern 4: Responsive Padding
```typescript
padding: contentPadding.horizontal
```

### Pattern 5: Screen-Specific Logic
```typescript
if (screenType === 'small') {
  // Show simplified version
} else if (screenType === 'tablet') {
  // Show expanded version
}
```
