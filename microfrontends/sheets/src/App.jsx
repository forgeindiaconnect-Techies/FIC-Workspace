import React, { useState } from 'react';
import DataGrid from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

const columns = [
  { key: 'id', name: 'ID', width: 80 },
  { key: 'colA', name: 'A', editable: true },
  { key: 'colB', name: 'B', editable: true },
  { key: 'colC', name: 'C', editable: true },
  { key: 'colD', name: 'D', editable: true },
  { key: 'colE', name: 'E', editable: true },
];

const initialRows = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  colA: '',
  colB: '',
  colC: '',
  colD: '',
  colE: '',
}));

const App = () => {
  const [rows, setRows] = useState(initialRows);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-600">Sheets</h1>
        <div className="text-sm text-gray-500">Edit cells directly</div>
      </header>
      <main className="flex-1 overflow-hidden p-4">
        <DataGrid 
          columns={columns} 
          rows={rows} 
          onRowsChange={setRows}
          className="h-full rounded-lg shadow-sm"
        />
      </main>
    </div>
  );
};

export default App;
