import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { Shape } from '../App';

const SYSTEM_INSTRUCTION = `Ets un tutor socràtic expert de geometria que guia els alumnes durant la resolució d’un problema geomètric que han de resoldre en un Canvas. La teva funció no és analitzar imatges, sinó interpretar dades estructurades (JSON) que representen els objectes geomètrics que l'alumne dibuixa en el Canvas.

La teva metodologia de treball:
1. Ignoraràs qualsevol percepció visual i et basaràs exclusivament en les coordenades (x, y) i les connexions que rebràs.
2. Les teves respostes s'han de limitar a dir si l'alumne ha resolt el problema o no, i a avaluar si hi ha un error en el seu procediment.
3. NO has de proporcionar cap informació respecte a la figura que l'alumne dibuixa (no diguis el nom de la figura, ni les seves propietats, ni les coordenades).
4. Has de seguir estrictament l'estratègia explicada al document "Les tres fases del procés d'aprenentatge per assaig-error" que se't proporciona a l'ESTRATÈGIA DIDÀCTICA.
5. ACTUA COM UN TUTOR SOCRÀTIC:
   - NO donis mai la resposta directa ni la solució final.
   - Fes preguntes guiades perquè l'alumne descobreixi el següent pas per si mateix.
   - Si l'alumne s'equivoca, fes-li notar la contradicció amb una pregunta.
   - Valida els passos correctes amb entusiasme i anima'l a continuar.
   - Si l'alumne es bloqueja, dóna-li una petita pista, però mai la instrucció completa.
6. RESTRICCIONS DE FORMAT I CONTINGUT:
   - Els teus textos han de tenir un màxim de dues frases.
   - Els teus textos han d'ocupar un màxim de dues línies.
   - Si l'alumne no demana explícitament una pista, NO proporcionis cap coneixement nou.
   - Limita't a avaluar si hi ha error i a generar preguntes que evidenciïn aquests errors.
7. SISTEMA D'UNITATS DE MÓN:
   - Totes les dades rebudes en format JSON utilitzen un sistema de "Coordenades de Món" absolut.
   - Aquestes unitats són invariants: no canvien encara que l'usuari faci zoom o desplaci el canvas.
   - La unitat base de càlcul és la Unitat de Coordenada (UC). Totes les operacions de distància (d = sqrt((x2-x1)^2 + (y2-y1)^2)) i d'àrea s'han d'executar sobre aquests valors numèrics directes.
   - Estableix una relació mètrica on 50 UC = 1 Unitat de Mesura Real (ex: 1 cm o 1 m).
8. ESPECIFICACIONS DE LA GRAELLA (GRID):
   - L'espai de treball està estructurat visualment en una graella on cada quadrat té una dimensió exacta de 50x50 Unitats de Coordenada, que equival a 1x1 Unitats de Mesura Real.
   - Quan analitzis una figura, tradueix les coordenades a "quadrats de graella" o "unitats de longitud" per facilitar la comprensió de l'alumne (ex: una línia de 150 UC s'ha de descriure com una línia que ocupa 3 quadrats o 3 unitats de longitud).
   - La graella és infinita i el punt d'origen (0,0) és la referència central per a tots els vèrtexs enviats.
   - Qualsevol càlcul de perímetre o superfície s'ha de referenciar en la seva equivalència en quadrats de graella (unitats de longitud o d'àrea) per mantenir la coherència visual.`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatPanel({ 
  shapes, 
  setShapes,
  messages,
  setMessages,
  onNewProblem,
  didacticFileContent,
  problem
}: { 
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onNewProblem: () => void;
  didacticFileContent?: string;
  problem: string;
}) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const identifyingRef = useRef<Set<string>>(new Set());
  const processedActionMsgsRef = useRef<Set<string>>(new Set());

  // We need to keep track of the chat session to maintain history
  const chatRef = useRef<any>(null);

  useEffect(() => {
    let finalInstruction = SYSTEM_INSTRUCTION;
    if (problem) {
      finalInstruction += `\n\nPROBLEMA GEOMÈTRIC A RESOLDRE:\n${problem}`;
    }
    if (didacticFileContent) {
      finalInstruction += `\n\nESTRATÈGIA DIDÀCTICA (Fitxer adjunt):\n${didacticFileContent}`;
    }

    chatRef.current = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: finalInstruction,
      },
    });
  }, [didacticFileContent, problem]);

  useEffect(() => {
    const checkNewShapes = async () => {
      const unnamedShapes = shapes.filter(s => !s.name && !identifyingRef.current.has(s.id));
      if (unnamedShapes.length > 0 && chatRef.current) {
        setIsLoading(true);
        try {
          unnamedShapes.forEach(s => identifyingRef.current.add(s.id));
          
          const newShapesWithNames = [];
          
          for (const newShape of unnamedShapes) {
            let prompt = '';
            if (newShape.type === 'circle') {
              prompt = `L'alumne acaba de dibuixar un cercle. Respon NOMÉS amb la paraula "Cercle".`;
            } else if (newShape.type === 'point') {
              prompt = `L'alumne acaba de dibuixar un punt. Respon NOMÉS amb la paraula "Punt".`;
            } else {
              prompt = newShape.closed
                ? `L'alumne acaba de tancar una nova figura amb aquestes coordenades:\n${JSON.stringify(newShape, null, 2)}\n\nIdentifica quina figura és. Respon NOMÉS amb el nom de la figura (ex: "Triangle", "Quadrat", "Rectangle", etc.), sense cap altra dada, explicació ni text addicional.`
                : `L'alumne acaba de dibuixar una figura oberta amb aquestes coordenades:\n${JSON.stringify(newShape, null, 2)}\n\nIdentifica si és un "Segment" (si té exactament 2 punts) o una "Línia poligonal" (si té més de 2 punts). Respon NOMÉS amb el nom ("Segment" o "Línia poligonal"), sense cap altra dada, explicació ni text addicional.`;
            }
            
            const response = await chatRef.current.sendMessage({ message: prompt });
            let shapeName = response.text?.trim() || 'Figura';
            shapeName = shapeName.replace(/["*`]/g, '');
            
            newShapesWithNames.push({ shape: newShape, baseName: shapeName });
          }
          
          const identified: { shape: Shape, finalName: string }[] = [];
          let tempShapes = [...shapes];
          
          for (const { shape, baseName } of newShapesWithNames) {
            const count = tempShapes.filter(s => s.name && s.name.startsWith(baseName)).length + 1;
            const finalName = `${baseName} ${count}`;
            identified.push({ shape, finalName });
            
            tempShapes = tempShapes.map(s => s.id === shape.id ? { ...s, name: finalName, showName: false } : s);
          }
          
          setShapes(tempShapes);
          
          setMessages(mPrev => {
            const newMsgs = [...mPrev];
            const splits = identified.filter(i => i.shape.splitFrom);
            const normals = identified.filter(i => !i.shape.splitFrom);
            
            // Group splits by splitFrom
            const splitGroups = new Map<string, typeof identified>();
            for (const s of splits) {
              const key = s.shape.splitFrom!;
              if (!splitGroups.has(key)) splitGroups.set(key, []);
              splitGroups.get(key)!.push(s);
            }
            
            for (const [splitFrom, group] of splitGroups.entries()) {
              if (group.length === 2) {
                newMsgs.push({
                  id: Date.now().toString() + Math.random(),
                  role: 'user',
                  content: `He tallat l'objecte ${splitFrom} i he fet ${group[0].finalName} i ${group[1].finalName}`
                });
              } else {
                for (const s of group) {
                  newMsgs.push({
                    id: Date.now().toString() + Math.random(),
                    role: 'user',
                    content: `He fet: ${s.finalName}`
                  });
                }
              }
            }
            
            for (const n of normals) {
              newMsgs.push({
                id: Date.now().toString() + Math.random(),
                role: 'user',
                content: `He fet: ${n.finalName}`
              });
            }
            
            return newMsgs;
          });
        } catch (error) {
          console.error('Error auto-identifying shape:', error);
          setShapes(prev => {
            let currentShapes = [...prev];
            for (const s of unnamedShapes) {
              currentShapes = currentShapes.map(cs => cs.id === s.id ? { ...cs, name: `Figura ${currentShapes.length}` } : cs);
            }
            return currentShapes;
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkNewShapes();
  }, [shapes, setShapes, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }

    // Check if the last message is an auto-generated user action that needs AI evaluation
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user' && (lastMsg.content.startsWith('He ') || lastMsg.content.startsWith('Selecciona '))) {
      const triggerAI = async () => {
        if (isLoading || !chatRef.current) return;
        setIsLoading(true);
        try {
          let promptWithData = '';
          if (lastMsg.content.startsWith("He demanat informació sobre l'objecte")) {
            promptWithData = `Acció de l'alumne: "${lastMsg.content}"\n\nDades actuals del Canvas (JSON):\n${JSON.stringify(shapes, null, 2)}\n\nL'alumne ha demanat informació sobre una figura. Com a excepció a les teves regles, HAS DE PROPORCIONAR tota la informació geomètrica que tinguis d'aquesta figura (dimensions, costats, superfície, angles, etc.) basant-te en les dades JSON. Pots utilitzar més de dues frases i línies per a aquesta resposta. Fes-ho de manera clara i didàctica.`;
          } else {
            promptWithData = `Acció de l'alumne: "${lastMsg.content}"\n\nDades actuals del Canvas (JSON):\n${JSON.stringify(shapes, null, 2)}\n\nCom a tutor socràtic, avalua aquesta acció en relació al problema plantejat. Pots fer preguntes per guiar l'alumne. NO proporcionis informació sobre la figura dibuixada directament, deixa que l'alumne ho descobreixi. Segueix l'estratègia de les tres fases del procés d'aprenentatge per assaig-error. Aquesta és la teva avaluació en el teu torn.`;
          }
          const response = await chatRef.current.sendMessage({ message: promptWithData });
          
          const newAssistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.text || 'Ho sento, no he pogut generar una resposta.',
          };
          
          setMessages((prev) => [...prev, newAssistantMsg]);
        } catch (error) {
          console.error('Error sending auto-message:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      if (!processedActionMsgsRef.current.has(lastMsg.id)) {
        processedActionMsgsRef.current.add(lastMsg.id);
        triggerAI();
      }
    }
  }, [messages, shapes, isLoading, setMessages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      // Append canvas data to the user's message behind the scenes
      const promptWithData = `Missatge de l'alumne: "${userText}"\n\nDades actuals del Canvas (JSON):\n${JSON.stringify(shapes, null, 2)}\n\nRespon com a tutor socràtic, tenint en compte el problema plantejat i les dades del Canvas. Limita't a dir si ha resolt el problema o no, i avalua si hi ha un error. NO proporcionis informació sobre la figura dibuixada. Segueix l'estratègia de les tres fases del procés d'aprenentatge per assaig-error.`;
      
      const response = await chatRef.current.sendMessage({ message: promptWithData });
      
      const newAssistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Ho sento, no he pogut generar una resposta.',
      };
      
      setMessages((prev) => [...prev, newAssistantMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: 'Hi ha hagut un error de connexió. Torna-ho a provar.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 bg-white border border-slate-200 text-slate-800 shadow-sm ${
                msg.role === 'assistant'
                  ? 'rounded-br-none'
                  : 'rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="markdown-body text-sm prose prose-sm max-w-none">
                  <Markdown>{msg.content}</Markdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-end">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-br-none p-3 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-sm text-slate-500">Pensant...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre el dibuix..."
            className="flex-1 px-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl outline-none transition-all text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <button
          onClick={onNewProblem}
          className="mt-3 w-full py-2 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
        >
          Nou problema
        </button>
      </div>
    </div>
  );
}
