import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const App = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: '<p>Welcome to Docs!</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none h-full min-h-[500px] p-4',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">Docs</h1>
        <div className="flex gap-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1 rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            List
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-[800px] border">
          <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
};

export default App;
