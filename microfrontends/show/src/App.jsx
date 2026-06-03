import React from 'react';
import {
  Deck,
  Slide,
  Heading,
  Text,
  UnorderedList,
  ListItem,
  FlexBox
} from 'spectacle';

const theme = {
  colors: {
    primary: '#1a202c',
    secondary: '#e53e3e',
    tertiary: '#f7fafc',
  },
  fonts: {
    header: 'Outfit, "Helvetica Neue", Helvetica, Arial, sans-serif',
    text: 'Outfit, "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
};

const App = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between z-10 relative shadow-sm">
        <h1 className="text-xl font-bold text-red-600">Show</h1>
        <div className="text-sm text-gray-500">Presentation Mode</div>
      </header>
      <main className="flex-1 relative">
        <Deck theme={theme}>
          <Slide>
            <FlexBox height="100%" flexDirection="column" justifyContent="center">
              <Heading margin="0px" fontSize="h1" color="primary">
                Welcome to Show
              </Heading>
              <Text color="secondary">A beautiful presentation app</Text>
            </FlexBox>
          </Slide>
          <Slide>
            <Heading color="primary">Features</Heading>
            <UnorderedList>
              <ListItem>Create slides easily</ListItem>
              <ListItem>Present anywhere</ListItem>
              <ListItem>Rich text formatting</ListItem>
            </UnorderedList>
          </Slide>
        </Deck>
      </main>
    </div>
  );
};

export default App;
