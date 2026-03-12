import { useState } from 'react';
import ChatPanel, { Message } from './components/ChatPanel';
import GeometryCanvas from './components/GeometryCanvas';
import { Plus, ArrowRight, Paperclip, Check } from 'lucide-react';

export type Point = { x: number; y: number };
export type ShapeType = 'polygon' | 'circle' | 'point' | 'angle' | 'text';

export type PointLabel = {
  name?: string;
  offset?: Point;
  hidden?: boolean;
};

export type SegmentLabel = {
  index: number;
  name: string;
  offset: Point;
};

export type Shape = { 
  id: string; 
  type: ShapeType;
  points: Point[]; 
  closed: boolean;
  radius?: number; // Only for circles
  name?: string;
  showName?: boolean;
  nameOffset?: Point;
  center?: Point;
  splitFrom?: string;
  parentId?: string;
  isPerpendicular?: boolean;
  isParallel?: boolean;
  pointLabels?: PointLabel[];
  segmentLabels?: SegmentLabel[];
  color?: string; // Color of the shape
  text?: string; // Text content for text shapes
};

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [problems, setProblems] = useState<string[]>([""]);
  const [didacticFiles, setDidacticFiles] = useState<string[]>([""]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState<number>(0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const addLog = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), role: 'user', content: text }]);
  };

  const triggerAI = async () => {
    // We'll implement this in ChatPanel by exposing a ref or we can just pass a flag
    // Actually, ChatPanel can just watch for new user messages that start with "He " or "Selecciona "
  };

  const handleStart = (index: number) => {
    setCurrentProblemIndex(index);
    const text = problems[index];
    if (text.trim()) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: text
        }
      ]);
    } else {
      setMessages([]);
    }
    setIsStarted(true);
  };

  const handleNewProblem = () => {
    setIsStarted(false);
    setShapes([]);
    setMessages([]);
  };

  if (!isStarted) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <div className="w-full py-8 flex justify-center">
          <h1 className="text-[20px] font-['Arial'] font-bold text-slate-800">
            GeoXat
          </h1>
        </div>
        <div className="flex-1 flex flex-col items-center pt-10 px-4 overflow-y-auto pb-10">
          <div className="w-full max-w-2xl flex flex-col gap-6">
            {problems.map((problem, index) => (
              <div key={index} className="w-full relative">
                <textarea
                  value={problem}
                  onChange={(e) => {
                    const newProblems = [...problems];
                    newProblems[index] = e.target.value;
                    setProblems(newProblems);
                  }}
                  placeholder="Escriu el problema geomètric aquí..."
                  className="w-full h-48 p-4 pr-24 rounded-xl border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none outline-none text-slate-700"
                />
                
                <div className="absolute right-4 bottom-4 flex gap-2">
                  <label
                    title={didacticFiles[index] ? "Document pujat correctament" : "Puja un document didàctic"}
                    className={`p-2 rounded-full cursor-pointer transition-colors shadow-md flex items-center justify-center ${
                      didacticFiles[index] ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {didacticFiles[index] ? <Check className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
                    <input
                      type="file"
                      accept=".txt,.md,.json,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const newFiles = [...didacticFiles];
                            newFiles[index] = text;
                            setDidacticFiles(newFiles);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => handleStart(index)}
                    title="Ves al GeoXat"
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            
            <div className="w-full flex justify-start">
              <button
                onClick={() => {
                  setProblems([...problems, ""]);
                  setDidacticFiles([...didacticFiles, ""]);
                }}
                title="Afegeix un nou problema"
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center justify-center"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Column: Chat */}
      <div className="w-1/3 h-full border-r border-slate-200 bg-white shadow-sm z-10 flex flex-col">
        <ChatPanel 
          shapes={shapes} 
          setShapes={setShapes} 
          messages={messages} 
          setMessages={setMessages} 
          onNewProblem={handleNewProblem}
          didacticFileContent={didacticFiles[currentProblemIndex]}
          problem={problems[currentProblemIndex]}
        />
      </div>

      {/* Right Column: Canvas */}
      <div className="w-2/3 h-full relative bg-slate-100 flex flex-col">
        <GeometryCanvas shapes={shapes} setShapes={setShapes} addLog={addLog} />
      </div>
    </div>
  );
}
