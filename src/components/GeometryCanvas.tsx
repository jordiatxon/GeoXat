import { useState, useRef, useEffect, MouseEvent, useMemo } from 'react';
import { Shape, Point, ShapeType, PointLabel } from '../App';
import { Trash2, PenTool, Undo2, Circle, Grid3X3, CircleDot, Scissors, Combine, MousePointer2, RotateCw, Hexagon, MoveUpRight, Eraser, Copy, FlipHorizontal, Ruler, Type, ZoomIn, Baseline, Info, Maximize } from 'lucide-react';

type Tool = 'select' | 'draw' | 'circle' | 'addPoint' | 'split' | 'merge' | 'rotate' | 'scale' | 'regularPolygon' | 'perpendicular' | 'parallel' | 'erase' | 'copy' | 'symmetry' | 'angle' | 'text' | 'compass' | 'label' | 'info';

const ParallelIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="9" y1="3" x2="15" y2="21" />
    <line x1="14" y1="3" x2="20" y2="21" />
  </svg>
);

const IrregularPolygonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 18 L10 6 L16 14 L20 4" />
  </svg>
);

const PointIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PerpendicularIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="4" y1="20" x2="20" y2="20" />
    <polyline points="12 16 16 16 16 20" />
  </svg>
);

const AngleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h16" />
    <path d="M4 20L16 4" />
    <path d="M10 20a6 6 0 0 0 2.5-4.5" />
  </svg>
);

const COLORS = [
  { name: 'Negre', value: '#000000' },
  { name: 'Vermell', value: '#ef4444' },
  { name: 'Blau', value: '#3b82f6' },
  { name: 'Verd', value: '#22c55e' },
  { name: 'Groc', value: '#eab308' },
  { name: 'Taronja', value: '#f97316' },
  { name: 'Violeta', value: '#8b5cf6' },
];

function distance(p1: Point, p2: Point) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function pointToSegmentDistance(p: Point, v: Point, w: Point) {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return { distance: distance(p, v), point: v };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { distance: distance(p, proj), point: proj };
}

export default function GeometryCanvas({
  shapes,
  setShapes,
  addLog,
}: {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  addLog: (msg: string) => void;
}) {
  const [tool, setTool] = useState<Tool>('select');
  const [currentColor, setCurrentColor] = useState<string>('#3b82f6'); // Default blue
  const [textPrompt, setTextPrompt] = useState<{ point: Point } | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>("");
  const [scalePrompt, setScalePrompt] = useState<{ shapeId: string, position: Point } | null>(null);
  const [scaleInputValue, setScaleInputValue] = useState<string>("2");
  const [addPointMode, setAddPointMode] = useState<'standalone' | 'edge' | 'midpoint'>('edge');
  const [regularPolygonSides, setRegularPolygonSides] = useState<number>(5);
  const [nextUppercaseIndex, setNextUppercaseIndex] = useState(0);
  const [nextLowercaseIndex, setNextLowercaseIndex] = useState(0);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ 
    primary: { shapeId: string; pointIndex: number };
    coincident: { shapeId: string; pointIndex: number }[];
    moved?: boolean; 
  } | null>(null);
  const [draggingShape, setDraggingShape] = useState<{ shapeId: string; offset: Point; moved?: boolean } | null>(null);
  const [draggingName, setDraggingName] = useState<{ shapeId: string; offset: Point } | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<{
    point: Point;
    startOffset: Point;
    startX: number;
    startY: number;
  } | null>(null);
  const [draggingSegmentLabel, setDraggingSegmentLabel] = useState<{
    shapeId: string;
    index: number;
    startOffset: Point;
    startX: number;
    startY: number;
  } | null>(null);
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ shapeId: string, insertIndex: number, point: Point, normal?: Point, p1?: Point, p2?: Point } | null>(null);
  const [draggingPerpendicular, setDraggingPerpendicular] = useState<{ startPoint: Point, normal: Point, shapeId: string } | null>(null);
  const [splitNodes, setSplitNodes] = useState<{ shapeId: string, pointIndex: number, point: Point, angle?: number }[]>([]);
  const [rotationState, setRotationState] = useState<{ center: Point | null; shapeId: string | null; angle: number }>({ center: null, shapeId: null, angle: 0 });
  const [symmetryMode, setSymmetryMode] = useState<'axial' | 'central'>('axial');
  const [symmetryState, setSymmetryState] = useState<{ step: 'select_shape' | 'select_reference', shapeId: string | null }>({ step: 'select_shape', shapeId: null });
  const [parallelState, setParallelState] = useState<{ step: 'select_edge' | 'place_line', edge: { p1: Point, p2: Point, shapeId: string } | null }>({ step: 'select_edge', edge: null });
  const [anglePoints, setAnglePoints] = useState<Point[]>([]);
  const [angleMode, setAngleMode] = useState<'measure' | 'amplitude'>('measure');
  const [amplitudePrompt, setAmplitudePrompt] = useState<{ p1: Point, p2: Point } | null>(null);
  const [amplitudeInputValue, setAmplitudeInputValue] = useState<string>("90");
  const [compassRadius, setCompassRadius] = useState<number | null>(null);
  const [draggingRotation, setDraggingRotation] = useState<{ 
    shapesState: { [id: string]: { originalPoints: Point[]; originalCenter?: Point } }; 
    startMouseAngle: number; 
    startHandleAngle: number 
  } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [lastPanPos, setLastPanPos] = useState<Point | null>(null);

  const getCanvasPoint = (e: React.MouseEvent | MouseEvent | React.WheelEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const rawX = (e.clientX - rect.left - pan.x) / zoom;
    const rawY = (e.clientY - rect.top - pan.y) / zoom;
    return { x: rawX, y: rawY };
  };

  const uniquePoints = useMemo(() => {
    const pts: { p: Point, name: string, offset: Point, hidden: boolean }[] = [];
    let letterIndex = 0;

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      for (let j = 0; j < shape.points.length; j++) {
        const p = shape.points[j];
        
        let found = false;
        for (const up of pts) {
          if (Math.abs(up.p.x - p.x) < 0.001 && Math.abs(up.p.y - p.y) < 0.001) {
            found = true;
            break;
          }
        }
        
        if (!found) {
          const label = shape.pointLabels?.[j];
          let name = label?.name;
          
          if (name) {
            pts.push({
              p,
              name,
              offset: label?.offset || { x: 8, y: -8 },
              hidden: !!label?.hidden
            });
          } else {
            // Still push the point to uniquePoints so we can click on it to label it later
            pts.push({
              p,
              name: '',
              offset: { x: 8, y: -8 },
              hidden: true
            });
          }
        }
      }
    }
    return pts;
  }, [shapes]);

  const updatePointLabel = (p: Point, updates: Partial<PointLabel>) => {
    setShapes(prevShapes => prevShapes.map(shape => {
      let changed = false;
      const newLabels = [...(shape.pointLabels || [])];
      
      for (let i = 0; i < shape.points.length; i++) {
        const sp = shape.points[i];
        if (Math.abs(sp.x - p.x) < 0.001 && Math.abs(sp.y - p.y) < 0.001) {
          newLabels[i] = { ...(newLabels[i] || {}), ...updates };
          changed = true;
        }
      }
      
      if (changed) {
        return { ...shape, pointLabels: newLabels };
      }
      return shape;
    }));
  };
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [gridEnabled, setGridEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const hasPannedRef = useRef(false);

  const snap = (val: number) => gridEnabled ? Math.round(val / 50) * 50 : val;
  const snapPoint = (p: Point) => ({ x: snap(p.x), y: snap(p.y) });

  // Resize canvas to fit container
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        drawAll();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [shapes, currentPoints, mousePos]);

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (gridEnabled) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1 / zoom;
      const gridSize = 50;
      
      const startX = -pan.x / zoom;
      const endX = (canvas.width - pan.x) / zoom;
      const startY = -pan.y / zoom;
      const endY = (canvas.height - pan.y) / zoom;

      const firstGridX = Math.floor(startX / gridSize) * gridSize;
      const firstGridY = Math.floor(startY / gridSize) * gridSize;

      for (let x = firstGridX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = firstGridY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }

    // Draw completed shapes
    shapes.forEach((shape) => {
      if (shape.points.length === 0) return;
      
      ctx.beginPath();
      if (shape.type === 'circle' && shape.radius) {
        ctx.arc(shape.points[0].x, shape.points[0].y, shape.radius, 0, Math.PI * 2);
      } else if (shape.type === 'point') {
        ctx.arc(shape.points[0].x, shape.points[0].y, 4, 0, Math.PI * 2);
      } else if (shape.type === 'angle' && shape.points.length === 3) {
        const p1 = shape.points[0];
        const p2 = shape.points[1]; // vertex
        const p3 = shape.points[2];
        
        const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        
        let startAngle = angle1;
        let endAngle = angle2;
        
        let diff = endAngle - startAngle;
        if (diff < 0) diff += 2 * Math.PI;
        
        const radius = 30;
        
        // Draw arc
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.arc(p2.x, p2.y, radius, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fill();
        
        // Draw arc stroke
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, radius, startAngle, endAngle);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
      }
      
      if (shape.type === 'text' && shape.text) {
        ctx.fillStyle = shape.color || '#3b82f6';
        ctx.font = '15px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y);
        return; // Skip other drawing logic for text shapes
      }
      
      if (shape.type !== 'angle') {
        if (shape.closed && shape.type !== 'point') {
          if (shape.type !== 'circle') ctx.closePath();
          
          // Use shape color with opacity for fill, or default
          if (shape.color) {
            // Convert hex to rgba for fill
            const hex = shape.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            ctx.fillStyle = shape.id === selectedShapeId 
              ? `rgba(${r}, ${g}, ${b}, 0.3)` 
              : `rgba(${r}, ${g}, ${b}, 0.1)`;
          } else {
            ctx.fillStyle = shape.id === selectedShapeId ? 'rgba(79, 70, 229, 0.3)' : 'rgba(79, 70, 229, 0.1)';
          }
          ctx.fill();
        } else if (shape.type === 'point') {
          ctx.fillStyle = shape.id === selectedShapeId ? '#312e81' : (shape.color || '#4f46e5');
          ctx.fill();
        }
        
        ctx.strokeStyle = shape.id === selectedShapeId ? '#312e81' : (shape.color || '#4f46e5');
        ctx.lineWidth = shape.id === selectedShapeId ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (shape.isPerpendicular) {
          ctx.setLineDash([5, 5]);
        }
        ctx.stroke();
        if (shape.isPerpendicular) {
          ctx.setLineDash([]);
        }
      }

      // Draw shape name
      if (shape.name && (shape.showName || shape.type === 'angle')) {
        const nameOffset = shape.nameOffset || { x: 10, y: -10 };
        ctx.fillStyle = '#312e81';
        ctx.font = '12px Inter, sans-serif';
        const textPos = shape.type === 'angle' && shape.points.length >= 2 ? shape.points[1] : shape.points[0];
        ctx.fillText(shape.name, textPos.x + nameOffset.x, textPos.y + nameOffset.y);
      }

      // Draw vertices (only for polygons or circle center)
      if (shape.type === 'polygon') {
        shape.points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        
        if (shape.center) {
          ctx.beginPath();
          ctx.arc(shape.center.x, shape.center.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (shape.type === 'circle') {
        // Draw center point
        ctx.beginPath();
        ctx.arc(shape.points[0].x, shape.points[0].y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw radius point if it exists
        if (shape.points.length > 1) {
          ctx.beginPath();
          ctx.arc(shape.points[1].x, shape.points[1].y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Draw dashed line from center to radius point
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          ctx.lineTo(shape.points[1].x, shape.points[1].y);
          ctx.strokeStyle = 'rgba(79, 70, 229, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw any additional points on the circle
        for (let i = 2; i < shape.points.length; i++) {
          ctx.beginPath();
          ctx.arc(shape.points[i].x, shape.points[i].y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });

    // Draw current shape
    if (currentPoints.length > 0) {
      ctx.beginPath();
      
      if ((tool === 'circle' || tool === 'regularPolygon') && mousePos) {
        const center = currentPoints[0];
        const radius = Math.sqrt(Math.pow(mousePos.x - center.x, 2) + Math.pow(mousePos.y - center.y, 2));
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        
        if (tool === 'regularPolygon') {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.beginPath();
          const angleOffset = Math.atan2(mousePos.y - center.y, mousePos.x - center.x);
          for (let i = 0; i < regularPolygonSides; i++) {
            const angle = angleOffset + (i * 2 * Math.PI) / regularPolygonSides;
            const px = center.x + radius * Math.cos(angle);
            const py = center.y + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
      } else {
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        
        // Draw line to mouse
        if (mousePos && (tool === 'draw' || tool === 'symmetry')) {
          ctx.lineTo(mousePos.x, mousePos.y);
        }
      }
      
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw current vertices
      currentPoints.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#fef3c7' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw angle in progress
    if (tool === 'angle' && anglePoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(anglePoints[0].x, anglePoints[0].y);
      if (anglePoints.length === 2) {
        ctx.lineTo(anglePoints[1].x, anglePoints[1].y);
        if (mousePos) {
          ctx.lineTo(mousePos.x, mousePos.y);
        }
      } else if (anglePoints.length === 1 && mousePos) {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      anglePoints.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 1 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === 1 ? '#fef3c7' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw hovered edge point for addPoint or perpendicular
    if ((tool === 'addPoint' || tool === 'perpendicular') && hoveredEdge && !draggingPerpendicular) {
      ctx.beginPath();
      ctx.arc(hoveredEdge.point.x, hoveredEdge.point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw dragging perpendicular line
    if (draggingPerpendicular && mousePos) {
      const v = { x: mousePos.x - draggingPerpendicular.startPoint.x, y: mousePos.y - draggingPerpendicular.startPoint.y };
      const dot = v.x * draggingPerpendicular.normal.x + v.y * draggingPerpendicular.normal.y;
      const endPoint = {
        x: draggingPerpendicular.startPoint.x + dot * draggingPerpendicular.normal.x,
        y: draggingPerpendicular.startPoint.y + dot * draggingPerpendicular.normal.y
      };

      ctx.beginPath();
      ctx.moveTo(draggingPerpendicular.startPoint.x, draggingPerpendicular.startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw right angle symbol
      const size = 10;
      const dx = draggingPerpendicular.normal.y; // perpendicular to normal (along the edge)
      const dy = -draggingPerpendicular.normal.x;
      const sign = dot > 0 ? 1 : -1;
      
      ctx.beginPath();
      ctx.moveTo(
        draggingPerpendicular.startPoint.x + dx * size,
        draggingPerpendicular.startPoint.y + dy * size
      );
      ctx.lineTo(
        draggingPerpendicular.startPoint.x + dx * size + draggingPerpendicular.normal.x * size * sign,
        draggingPerpendicular.startPoint.y + dy * size + draggingPerpendicular.normal.y * size * sign
      );
      ctx.lineTo(
        draggingPerpendicular.startPoint.x + draggingPerpendicular.normal.x * size * sign,
        draggingPerpendicular.startPoint.y + draggingPerpendicular.normal.y * size * sign
      );
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw parallel line preview
    if (tool === 'parallel' && parallelState.step === 'place_line' && parallelState.edge && mousePos) {
      const { p1, p2 } = parallelState.edge;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 0) {
        const normal = { x: -dy / length, y: dx / length };
        const dot = (mousePos.x - p1.x) * normal.x + (mousePos.y - p1.y) * normal.y;
        const offset = { x: normal.x * dot, y: normal.y * dot };
        const newP1 = { x: p1.x + offset.x, y: p1.y + offset.y };
        const newP2 = { x: p2.x + offset.x, y: p2.y + offset.y };

        ctx.beginPath();
        ctx.moveTo(newP1.x, newP1.y);
        ctx.lineTo(newP2.x, newP2.y);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw split line
    if (tool === 'split' && splitNodes.length > 0 && mousePos) {
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      for (let i = 0; i < splitNodes.length; i++) {
        ctx.beginPath();
        ctx.arc(splitNodes[i].point.x, splitNodes[i].point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(splitNodes[0].point.x, splitNodes[0].point.y);
      for (let i = 1; i < splitNodes.length; i++) {
        ctx.lineTo(splitNodes[i].point.x, splitNodes[i].point.y);
      }
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw rotation UI
    if (tool === 'rotate' && rotationState.center) {
      const cx = rotationState.center.x;
      const cy = rotationState.center.y;
      
      // Draw center
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ec4899';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (rotationState.shapeId) {
        const R = 60;
        // Draw arc
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw handle
        const hx = cx + R * Math.cos(rotationState.angle);
        const hy = cy + R * Math.sin(rotationState.angle);
        
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(hx, hy);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hx, hy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ec4899';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (tool === 'symmetry' && symmetryState.step === 'select_reference' && symmetryState.shapeId) {
      const shape = shapes.find(s => s.id === symmetryState.shapeId);
      if (shape) {
        ctx.save();
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        if (shape.type === 'polygon') {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(shape.points[i].x, shape.points[i].y);
          }
          if (shape.closed) ctx.closePath();
          ctx.stroke();
        } else if (shape.type === 'circle' && shape.radius) {
          ctx.beginPath();
          ctx.arc(shape.points[0].x, shape.points[0].y, shape.radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Draw point names
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    for (const up of uniquePoints) {
      if (!up.hidden) {
        ctx.fillText(up.name, up.p.x + up.offset.x, up.p.y + up.offset.y);
      }
    }

    // Draw segment labels
    for (const shape of shapes) {
      if (shape.segmentLabels) {
        for (const label of shape.segmentLabels) {
          const p1 = shape.points[label.index];
          const p2 = shape.points[(label.index + 1) % shape.points.length];
          if (p1 && p2) {
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            ctx.fillText(label.name, midX + label.offset.x, midY + label.offset.y);
          }
        }
      }
    }

    ctx.restore();
  };

  useEffect(() => {
    drawAll();
  }, [shapes, currentPoints, mousePos, gridEnabled, hoveredEdge, splitNodes, tool, selectedShapeId, rotationState, draggingRotation, draggingName, regularPolygonSides, uniquePoints, zoom, pan]);

  const findSharedEdge = (currentShapes: Shape[]) => {
    for (let i = 0; i < currentShapes.length; i++) {
      const s1 = currentShapes[i];
      if (s1.type !== 'polygon' || !s1.closed) continue;
      
      for (let j = i + 1; j < currentShapes.length; j++) {
        const s2 = currentShapes[j];
        if (s2.type !== 'polygon' || !s2.closed) continue;
        
        for (let e1 = 0; e1 < s1.points.length; e1++) {
          const a1 = s1.points[e1];
          const b1 = s1.points[(e1 + 1) % s1.points.length];
          
          for (let e2 = 0; e2 < s2.points.length; e2++) {
            const a2 = s2.points[e2];
            const b2 = s2.points[(e2 + 1) % s2.points.length];
            
            const threshold = 10;
            const match1 = distance(a1, b2) < threshold && distance(b1, a2) < threshold;
            const match2 = distance(a1, a2) < threshold && distance(b1, b2) < threshold;
            
            if (match1 || match2) {
              return { s1, s2, e1, e2, matchType: match1 ? 'opposite' : 'same' };
            }
          }
        }
      }
    }
    return null;
  };

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      return;
    }

    if (tool === 'select' || tool === 'info') return;

    const { x: rawX, y: rawY } = getCanvasPoint(e);
    let { x, y } = snapPoint({ x: rawX, y: rawY });

    let minDist = 10;
    for (const shape of shapes) {
      for (const p of shape.points) {
        const d = distance({x: rawX, y: rawY}, p);
        if (d < minDist) {
          minDist = d;
          x = p.x;
          y = p.y;
        }
      }
    }

    if (tool === 'erase') {
      // Check for point label click first
      for (const up of uniquePoints) {
        if (up.hidden) continue;
        const lx = up.p.x + up.offset.x;
        const ly = up.p.y + up.offset.y;
        const width = up.name.length * 9;
        const height = 14;
        
        if (x >= lx - 4 && x <= lx + width + 4 && y >= ly - height - 4 && y <= ly + 4) {
          updatePointLabel(up.p, { hidden: true });
          addLog(`He esborrat la lletra ${up.name}`);
          return;
        }
      }

      // Check for segment label click
      for (const shape of shapes) {
        if (shape.segmentLabels) {
          for (const label of shape.segmentLabels) {
            const p1 = shape.points[label.index];
            const p2 = shape.points[(label.index + 1) % shape.points.length];
            if (p1 && p2) {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const lx = midX + label.offset.x;
              const ly = midY + label.offset.y;
              const width = label.name.length * 9;
              const height = 14;
              
              if (x >= lx - 4 && x <= lx + width + 4 && y >= ly - height - 4 && y <= ly + 4) {
                setShapes(shapes.map(s => {
                  if (s.id === shape.id) {
                    return { ...s, segmentLabels: s.segmentLabels?.filter(l => l.index !== label.index) };
                  }
                  return s;
                }));
                addLog(`He esborrat la lletra ${label.name}`);
                return;
              }
            }
          }
        }
      }

      // Check for shape name click
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.name && shape.showName) {
          const nameOffset = shape.nameOffset || { x: 10, y: -10 };
          const textPos = shape.type === 'angle' && shape.points.length >= 2 ? shape.points[1] : shape.points[0];
          const textX = textPos.x + nameOffset.x;
          const textY = textPos.y + nameOffset.y;
          const textWidth = shape.name.length * 7;
          const textHeight = 16;
          
          if (
            x >= textX && 
            x <= textX + textWidth && 
            y >= textY - textHeight && 
            y <= textY
          ) {
            setShapes(shapes.map(s => s.id === shape.id ? { ...s, showName: false } : s));
            addLog(`He amagat el nom de la figura ${shape.name}`);
            return;
          }
        }
      }

      let clickedShapeId = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id; break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id; break;
            }
          } else {
            let isNear = false;
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                isNear = true; break;
              }
            }
            if (isNear) {
              clickedShapeId = shape.id; break;
            }
          }
        } else if (shape.type === 'point') {
          if (distance(shape.points[0], {x, y}) < 10) {
            clickedShapeId = shape.id; break;
          }
        }
      }
      if (clickedShapeId) {
        const shapeName = shapes.find(s => s.id === clickedShapeId)?.name || 'desconegut';
        setShapes(shapes.filter(s => s.id !== clickedShapeId && s.parentId !== clickedShapeId));
        addLog(`He esborrat l'objecte ${shapeName}`);
      }
      return;
    }

    if (tool === 'copy') {
      let clickedShapeId = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id; break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id; break;
            }
          } else {
            let isNear = false;
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                isNear = true; break;
              }
            }
            if (isNear) {
              clickedShapeId = shape.id; break;
            }
          }
        } else if (shape.type === 'point') {
          if (distance(shape.points[0], {x, y}) < 10) {
            clickedShapeId = shape.id; break;
          }
        }
      }

      if (clickedShapeId) {
        const shapeToCopy = shapes.find(s => s.id === clickedShapeId);
        if (shapeToCopy) {
          const getDescendants = (parentId: string, allShapes: Shape[]): Shape[] => {
            const children = allShapes.filter(s => s.parentId === parentId);
            let descendants = [...children];
            for (const child of children) {
              descendants = descendants.concat(getDescendants(child.id, allShapes));
            }
            return descendants;
          };

          const descendants = getDescendants(shapeToCopy.id, shapes);
          const shapesToCopy = [shapeToCopy, ...descendants];
          
          const offset = 20;
          const newShapes = shapesToCopy.map(s => {
            const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const newPoints = s.points.map(p => ({ x: p.x + offset, y: p.y + offset }));
            const newCenter = s.center ? { x: s.center.x + offset, y: s.center.y + offset } : undefined;
            return {
              ...s,
              id: newId,
              points: newPoints,
              center: newCenter,
              parentId: s.parentId === shapeToCopy.parentId ? undefined : s.parentId, // Keep internal hierarchy, break external
              name: undefined, // Don't copy names to avoid duplicates
              pointLabels: undefined // Don't copy point labels
            };
          });

          // Fix internal parentIds
          const idMap = new Map(shapesToCopy.map((s, i) => [s.id, newShapes[i].id]));
          newShapes.forEach(s => {
            if (s.parentId && idMap.has(s.parentId)) {
              s.parentId = idMap.get(s.parentId);
            }
          });

          setShapes([...shapes, ...newShapes]);
          addLog(`He copiat l'objecte ${shapeToCopy.name || 'desconegut'}`);
        }
      }
      return;
    }

    if (tool === 'symmetry') {
      if (symmetryState.step === 'select_shape') {
        let clickedShapeId = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (shape.type === 'circle' && shape.radius) {
            if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
              clickedShapeId = shape.id; break;
            }
          } else if (shape.type === 'polygon') {
            if (shape.closed) {
              if (isPointInPolygon({ x, y }, shape.points)) {
                clickedShapeId = shape.id; break;
              }
            } else {
              let isNear = false;
              for (let j = 0; j < shape.points.length - 1; j++) {
                if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                  isNear = true; break;
                }
              }
              if (isNear) {
                clickedShapeId = shape.id; break;
              }
            }
          } else if (shape.type === 'point') {
            if (distance(shape.points[0], {x, y}) < 10) {
              clickedShapeId = shape.id; break;
            }
          }
        }

        if (clickedShapeId) {
          setSymmetryState({ step: 'select_reference', shapeId: clickedShapeId });
          addLog(`Selecciona l'eix o centre de simetria`);
        }
      } else if (symmetryState.step === 'select_reference' && symmetryState.shapeId) {
        const shapeToCopy = shapes.find(s => s.id === symmetryState.shapeId);
        if (!shapeToCopy) return;

        const getDescendants = (parentId: string, allShapes: Shape[]): Shape[] => {
          const children = allShapes.filter(s => s.parentId === parentId);
          let descendants = [...children];
          for (const child of children) {
            descendants = descendants.concat(getDescendants(child.id, allShapes));
          }
          return descendants;
        };

        const descendants = getDescendants(shapeToCopy.id, shapes);
        const shapesToCopy = [shapeToCopy, ...descendants];

        if (symmetryMode === 'axial') {
          const newPoints = [...currentPoints, { x, y }];
          setCurrentPoints(newPoints);
          
          if (newPoints.length === 2) {
            const p1 = newPoints[0];
            const p2 = newPoints[1];
            
            const A = p2.y - p1.y;
            const B = p1.x - p2.x;
            const C = p2.x * p1.y - p1.x * p2.y;
            const denom = A * A + B * B;

            if (denom !== 0) {
              const reflectPoint = (p: Point): Point => {
                const nx = (p.x * (B * B - A * A) - 2 * A * (B * p.y + C)) / denom;
                const ny = (p.y * (A * A - B * B) - 2 * B * (A * p.x + C)) / denom;
                return { x: nx, y: ny };
              };

              const newShapes = shapesToCopy.map(s => {
                const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                const newPoints = s.points.map(reflectPoint);
                const newCenter = s.center ? reflectPoint(s.center) : undefined;
                return {
                  ...s,
                  id: newId,
                  points: newPoints,
                  center: newCenter,
                  parentId: s.parentId === shapeToCopy.parentId ? undefined : s.parentId,
                  name: undefined,
                  pointLabels: undefined
                };
              });

              const idMap = new Map(shapesToCopy.map((s, i) => [s.id, newShapes[i].id]));
              newShapes.forEach(s => {
                if (s.parentId && idMap.has(s.parentId)) {
                  s.parentId = idMap.get(s.parentId);
                }
              });

              const axisShape: Shape = {
                id: Date.now().toString() + 'axis',
                type: 'polygon',
                points: newPoints,
                closed: false
              };

              setShapes([...shapes, axisShape, ...newShapes]);
              addLog(`He fet la simetria axial de l'objecte ${shapeToCopy.name || 'desconegut'}`);
              setSymmetryState({ step: 'select_shape', shapeId: null });
              setCurrentPoints([]);
            } else {
              setCurrentPoints([]);
            }
          }
        } else if (symmetryMode === 'central') {
          const cx = x;
          const cy = y;

          const reflectPoint = (p: Point): Point => {
            return { x: 2 * cx - p.x, y: 2 * cy - p.y };
          };

          const newShapes = shapesToCopy.map(s => {
            const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const newPoints = s.points.map(reflectPoint);
            const newCenter = s.center ? reflectPoint(s.center) : undefined;
            return {
              ...s,
              id: newId,
              points: newPoints,
              center: newCenter,
              parentId: s.parentId === shapeToCopy.parentId ? undefined : s.parentId,
              name: undefined,
              pointLabels: undefined
            };
          });

          const idMap = new Map(shapesToCopy.map((s, i) => [s.id, newShapes[i].id]));
          newShapes.forEach(s => {
            if (s.parentId && idMap.has(s.parentId)) {
              s.parentId = idMap.get(s.parentId);
            }
          });

          const centerShape: Shape = {
            id: Date.now().toString() + 'center',
            type: 'point',
            points: [{ x: cx, y: cy }],
            closed: false
          };

          setShapes([...shapes, centerShape, ...newShapes]);
          addLog(`He fet la simetria central de l'objecte ${shapeToCopy.name || 'desconegut'}`);
          setSymmetryState({ step: 'select_shape', shapeId: null });
        }
      }
      return;
    }

    if (tool === 'compass') {
      if (compassRadius === null) {
        // Step 1: Select radius
        if (hoveredEdge && hoveredEdge.p1 && hoveredEdge.p2) {
          // Selected an edge
          const r = distance(hoveredEdge.p1, hoveredEdge.p2);
          setCompassRadius(r);
          addLog(`Radi seleccionat: ${r.toFixed(1)}px. Ara selecciona el centre.`);
          setCurrentPoints([]);
        } else {
          // Selected a point
          const newPoints = [...currentPoints, { x, y }];
          setCurrentPoints(newPoints);
          if (newPoints.length === 2) {
            const r = distance(newPoints[0], newPoints[1]);
            setCompassRadius(r);
            addLog(`Radi seleccionat: ${r.toFixed(1)}px. Ara selecciona el centre.`);
            setCurrentPoints([]);
          }
        }
      } else {
        // Step 2: Select center
        const newShape: Shape = {
          id: Date.now().toString(),
          type: 'circle',
          points: [{ x, y }],
          radius: compassRadius,
          closed: true
        };
        setShapes([...shapes, newShape]);
        addLog(`He dibuixat un cercle amb el compàs`);
        setCompassRadius(null);
        setCurrentPoints([]);
      }
      return;
    }

    if (tool === 'angle') {
      const newPoints = [...anglePoints, { x, y }];
      setAnglePoints(newPoints);
      
      if (angleMode === 'measure') {
        if (newPoints.length === 3) {
          const p1 = newPoints[0];
          const p2 = newPoints[1]; // vertex
          const p3 = newPoints[2];
          
          const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
          const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
          
          let diff = angle2 - angle1;
          if (diff < 0) diff += 2 * Math.PI;
          
          const degrees = (diff * 180 / Math.PI).toFixed(1);
          
          const angleShape: Shape = {
            id: Date.now().toString() + 'angle',
            type: 'angle',
            points: newPoints,
            closed: false,
            name: `${degrees}°`,
            nameOffset: { x: 20, y: -20 }
          };
          
          setShapes([...shapes, angleShape]);
          addLog(`He mesurat un angle de ${degrees}°`);
          setAnglePoints([]);
        }
      } else if (angleMode === 'amplitude') {
        if (newPoints.length === 2) {
          setAmplitudePrompt({ p1: newPoints[0], p2: newPoints[1] });
        }
      }
      return;
    }

    if (tool === 'text') {
      setTextPrompt({ point: { x, y } });
      setTextInputValue("");
      return;
    }

    if (tool === 'label') {
      // 1. Check if clicked on a point
      for (const up of uniquePoints) {
        if (distance({ x, y }, up.p) <= 10) {
          // Assign uppercase letter
          let letter = '';
          if (nextUppercaseIndex < 26) {
            letter = String.fromCharCode(65 + nextUppercaseIndex);
          } else {
            letter = String.fromCharCode(65 + (nextUppercaseIndex % 26)) + Math.floor(nextUppercaseIndex / 26);
          }
          updatePointLabel(up.p, { name: letter, hidden: false });
          setNextUppercaseIndex(prev => prev + 1);
          addLog(`He afegit la lletra ${letter} a un punt`);
          return;
        }
      }

      // 2. Check if clicked on an edge
      if (hoveredEdge) {
        let letter = '';
        if (nextLowercaseIndex < 26) {
          letter = String.fromCharCode(97 + nextLowercaseIndex);
        } else {
          letter = String.fromCharCode(97 + (nextLowercaseIndex % 26)) + Math.floor(nextLowercaseIndex / 26);
        }
        
        setShapes(shapes.map(s => {
          if (s.id === hoveredEdge.shapeId) {
            const newSegmentLabels = [...(s.segmentLabels || [])];
            const existingIndex = newSegmentLabels.findIndex(l => l.index === hoveredEdge.insertIndex - 1);
            if (existingIndex >= 0) {
              newSegmentLabels[existingIndex] = { ...newSegmentLabels[existingIndex], name: letter };
            } else {
              newSegmentLabels.push({ index: hoveredEdge.insertIndex - 1, name: letter, offset: { x: 10, y: -10 } });
            }
            return { ...s, segmentLabels: newSegmentLabels };
          }
          return s;
        }));
        setNextLowercaseIndex(prev => prev + 1);
        addLog(`He afegit la lletra ${letter} a un segment`);
        return;
      }

      // 3. Check if clicked inside a shape
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'polygon' && shape.closed && isPointInPolygon({ x, y }, shape.points)) {
          if (shape.name) {
            setShapes(shapes.map(s => s.id === shape.id ? { ...s, showName: true } : s));
            addLog(`He mostrat el nom de la figura ${shape.name}`);
          }
          return;
        } else if (shape.type === 'circle' && shape.center && shape.radius && isPointInCircle({ x, y }, shape.center, shape.radius)) {
          if (shape.name) {
            setShapes(shapes.map(s => s.id === shape.id ? { ...s, showName: true } : s));
            addLog(`He mostrat el nom de la figura ${shape.name}`);
          }
          return;
        }
      }
      return;
    }

    if (tool === 'rotate') {
      // If we already have a center and click on empty space, move the center
      // If we click on a shape, select it for rotation
      let clickedShapeId = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id; break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id; break;
            }
          } else {
            let isNear = false;
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                isNear = true; break;
              }
            }
            if (isNear) { clickedShapeId = shape.id; break; }
          }
        }
      }

      if (clickedShapeId) {
        // If we clicked a shape but have no center, use the click point as center
        if (!rotationState.center) {
          setRotationState({ center: { x, y }, shapeId: clickedShapeId, angle: 0 });
        } else {
          setRotationState({ ...rotationState, shapeId: clickedShapeId, angle: 0 });
        }
        setSelectedShapeId(clickedShapeId);
      } else {
        // Clicked empty space, move center
        setRotationState({ center: { x, y }, shapeId: null, angle: 0 });
        setSelectedShapeId(null);
      }
      return;
    }

    if (tool === 'scale') {
      let clickedShapeId = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id; break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id; break;
            }
          } else {
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({ x, y }, shape.points[j], shape.points[j + 1]).distance < 10) {
                clickedShapeId = shape.id; break;
              }
            }
          }
        } else if (shape.type === 'point') {
          if (distance({ x, y }, shape.points[0]) < 10) {
            clickedShapeId = shape.id; break;
          }
        }
        if (clickedShapeId) break;
      }

      if (clickedShapeId) {
        setScalePrompt({ shapeId: clickedShapeId, position: { x, y } });
      }
      return;
    }

    if (tool === 'merge') {
      const match = findSharedEdge(shapes);
      if (match) {
        const { s1, s2, e1, e2, matchType } = match;
        const newPoints = [];
        for (let i = 0; i <= e1; i++) {
          newPoints.push(s1.points[i]);
        }

        const m = s2.points.length;
        if (matchType === 'opposite') {
          let curr = (e2 + 2) % m;
          const end = e2;
          while (curr !== end) {
            newPoints.push(s2.points[curr]);
            curr = (curr + 1) % m;
          }
        } else {
          let curr = (e2 - 1 + m) % m;
          const end = (e2 + 1) % m;
          while (curr !== end) {
            newPoints.push(s2.points[curr]);
            curr = (curr - 1 + m) % m;
          }
        }

        for (let i = e1 + 1; i < s1.points.length; i++) {
          newPoints.push(s1.points[i]);
        }

        const newShape = {
          id: Date.now().toString(),
          type: 'polygon' as ShapeType,
          points: newPoints,
          closed: true
        };
        setShapes(shapes.filter(s => s.id !== s1.id && s.id !== s2.id).concat(newShape));
        addLog(`He agrupat els objectes ${s1.name || 'desconegut'} i ${s2.name || 'desconegut'}`);
      }
      return;
    }

    if (tool === 'perpendicular') {
      if (hoveredEdge && hoveredEdge.normal) {
        setDraggingPerpendicular({
          startPoint: hoveredEdge.point,
          normal: hoveredEdge.normal,
          shapeId: hoveredEdge.shapeId
        });
      }
      return;
    }

    if (tool === 'parallel') {
      if (parallelState.step === 'select_edge') {
        if (hoveredEdge && hoveredEdge.p1 && hoveredEdge.p2) {
          setParallelState({
            step: 'place_line',
            edge: { p1: hoveredEdge.p1, p2: hoveredEdge.p2, shapeId: hoveredEdge.shapeId }
          });
          addLog(`He seleccionat una recta per fer-ne la paral·lela. Fes clic on vols posar-la.`);
        }
      } else if (parallelState.step === 'place_line' && parallelState.edge) {
        const { p1, p2, shapeId } = parallelState.edge;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const normal = { x: -dy / length, y: dx / length };
          const dot = (x - p1.x) * normal.x + (y - p1.y) * normal.y;
          const offset = { x: normal.x * dot, y: normal.y * dot };
          const newP1 = { x: p1.x + offset.x, y: p1.y + offset.y };
          const newP2 = { x: p2.x + offset.x, y: p2.y + offset.y };
          
          setShapes([...shapes, {
            id: Date.now().toString(),
            type: 'polygon',
            points: [newP1, newP2],
            closed: false,
            parentId: shapeId,
            isParallel: true
          }]);
          addLog(`He fet una paral·lela`);
          setParallelState({ step: 'select_edge', edge: null });
        }
      }
      return;
    }

    if (tool === 'addPoint') {
      if (addPointMode === 'standalone') {
        const newPointShape = {
          id: Date.now().toString(),
          type: 'point' as ShapeType,
          points: [{ x, y }],
          closed: false,
          color: currentColor
        };
        setShapes([...shapes, newPointShape]);
        addLog(`He fet un punt`);
      } else if (hoveredEdge) {
        setShapes(shapes.map(s => {
          if (s.id === hoveredEdge.shapeId) {
            const newPoints = [...s.points];
            newPoints.splice(hoveredEdge.insertIndex, 0, hoveredEdge.point);
            addLog(`He afegit un punt a l'objecte ${s.name || 'desconegut'}`);
            return { ...s, points: newPoints };
          }
          return s;
        }));
        setHoveredEdge(null);
      }
      return;
    }

    if (tool === 'split') {
      let clickedVertex: { shapeId: string, pointIndex: number, point: Point, angle?: number } | null = null;
      for (const shape of shapes) {
        if (shape.type === 'polygon' && shape.closed) {
          for (let i = 0; i < shape.points.length; i++) {
            const p = shape.points[i];
            if (distance(p, {x, y}) < 10) {
              clickedVertex = { shapeId: shape.id, pointIndex: i, point: p };
              break;
            }
          }
        } else if (shape.type === 'circle' && shape.radius) {
          if (distance(shape.points[0], {x, y}) < 10) {
            clickedVertex = { shapeId: shape.id, pointIndex: 0, point: shape.points[0] };
          } else {
            for (let i = 1; i < shape.points.length; i++) {
              const p = shape.points[i];
              if (distance(p, {x, y}) < 10) {
                clickedVertex = { shapeId: shape.id, pointIndex: i, point: p };
                break;
              }
            }
            if (!clickedVertex) {
              const distToCenter = distance({x, y}, shape.points[0]);
              if (Math.abs(distToCenter - shape.radius) < 10) {
                const angle = Math.atan2(y - shape.points[0].y, x - shape.points[0].x);
                const p = {
                  x: shape.points[0].x + shape.radius * Math.cos(angle),
                  y: shape.points[0].y + shape.radius * Math.sin(angle)
                };
                clickedVertex = { shapeId: shape.id, pointIndex: -1, point: p, angle };
              }
            }
          }
        }
        if (clickedVertex) break;
      }

      if (clickedVertex) {
        if (splitNodes.length === 0) {
          if (clickedVertex.pointIndex === 0 && shapes.find(s => s.id === clickedVertex!.shapeId)?.type === 'circle') {
            return;
          }
          setSplitNodes([clickedVertex]);
        } else {
          if (splitNodes[0].shapeId !== clickedVertex.shapeId) {
            if (clickedVertex.pointIndex === 0 && shapes.find(s => s.id === clickedVertex!.shapeId)?.type === 'circle') {
              setSplitNodes([]);
            } else {
              setSplitNodes([clickedVertex]);
            }
            return;
          }

          const shape = shapes.find(s => s.id === splitNodes[0].shapeId);
          if (shape) {
            if (shape.type === 'polygon') {
              const i = splitNodes[0].pointIndex;
              const j = clickedVertex.pointIndex;
              const n = shape.points.length;
              
              const isAdjacent = Math.abs(i - j) === 1 || Math.abs(i - j) === n - 1 || i === j;
              if (!isAdjacent) {
                const minIdx = Math.min(i, j);
                const maxIdx = Math.max(i, j);
                
                const poly1Points = shape.points.slice(minIdx, maxIdx + 1);
                const poly2Points = [
                  ...shape.points.slice(maxIdx, n),
                  ...shape.points.slice(0, minIdx + 1)
                ];
                
                const getCentroid = (pts: Point[]) => {
                  let cx = 0, cy = 0;
                  for (const p of pts) { cx += p.x; cy += p.y; }
                  return { x: cx / pts.length, y: cy / pts.length };
                };
                
                const c1 = getCentroid(poly1Points);
                const c2 = getCentroid(poly2Points);
                
                const dirX = c1.x - c2.x;
                const dirY = c1.y - c2.y;
                const dist = Math.sqrt(dirX*dirX + dirY*dirY);
                const nx = dist > 0 ? dirX / dist : 1;
                const ny = dist > 0 ? dirY / dist : 0;
                
                const offsetDist = 15;
                
                const newPoly1 = {
                  id: Date.now().toString() + '-1',
                  type: 'polygon' as ShapeType,
                  points: poly1Points.map(p => ({ x: p.x + nx * offsetDist, y: p.y + ny * offsetDist })),
                  closed: true,
                  splitFrom: shape.name || 'desconegut'
                };
                
                const newPoly2 = {
                  id: Date.now().toString() + '-2',
                  type: 'polygon' as ShapeType,
                  points: poly2Points.map(p => ({ x: p.x - nx * offsetDist, y: p.y - ny * offsetDist })),
                  closed: true,
                  splitFrom: shape.name || 'desconegut'
                };
                
                setShapes(shapes.filter(s => s.id !== shape.id).concat([newPoly1, newPoly2]));
              }
              setSplitNodes([]);
            } else if (shape.type === 'circle' && shape.radius) {
              if (splitNodes.length === 1) {
                if (clickedVertex.pointIndex === 0) {
                  setSplitNodes([...splitNodes, clickedVertex]);
                } else {
                  setSplitNodes([clickedVertex]);
                }
              } else if (splitNodes.length === 2) {
                if (clickedVertex.pointIndex !== 0) {
                  const getAngle = (v: { point: Point, angle?: number }) => {
                    if (v.angle !== undefined) return v.angle;
                    return Math.atan2(v.point.y - shape.points[0].y, v.point.x - shape.points[0].x);
                  };
                  
                  let a1 = getAngle(splitNodes[0]);
                  let a2 = getAngle(clickedVertex);
                  
                  if (Math.abs(a1 - a2) > 0.01) {
                    if (a1 > a2) {
                      const temp = a1; a1 = a2; a2 = temp;
                    }
                    
                    const poly1Points = [shape.points[0]];
                    const steps1 = Math.max(10, Math.floor((a2 - a1) / (Math.PI * 2) * 36));
                    for (let i = 0; i <= steps1; i++) {
                      const a = a1 + (a2 - a1) * (i / steps1);
                      poly1Points.push({
                        x: shape.points[0].x + shape.radius * Math.cos(a),
                        y: shape.points[0].y + shape.radius * Math.sin(a)
                      });
                    }
                    
                    const poly2Points = [shape.points[0]];
                    const steps2 = Math.max(10, Math.floor(((a1 + Math.PI * 2) - a2) / (Math.PI * 2) * 36));
                    for (let i = 0; i <= steps2; i++) {
                      const a = a2 + ((a1 + Math.PI * 2) - a2) * (i / steps2);
                      poly2Points.push({
                        x: shape.points[0].x + shape.radius * Math.cos(a),
                        y: shape.points[0].y + shape.radius * Math.sin(a)
                      });
                    }
                    
                    const offsetDist = 15;
                    const midAngle1 = a1 + (a2 - a1) / 2;
                    const nx1 = Math.cos(midAngle1);
                    const ny1 = Math.sin(midAngle1);
                    
                    const midAngle2 = a2 + ((a1 + Math.PI * 2) - a2) / 2;
                    const nx2 = Math.cos(midAngle2);
                    const ny2 = Math.sin(midAngle2);
                    
                    const newPoly1 = {
                      id: Date.now().toString() + '-1',
                      type: 'polygon' as ShapeType,
                      points: poly1Points.map(p => ({ x: p.x + nx1 * offsetDist, y: p.y + ny1 * offsetDist })),
                      closed: true,
                      splitFrom: shape.name || 'desconegut'
                    };
                    
                    const newPoly2 = {
                      id: Date.now().toString() + '-2',
                      type: 'polygon' as ShapeType,
                      points: poly2Points.map(p => ({ x: p.x + nx2 * offsetDist, y: p.y + ny2 * offsetDist })),
                      closed: true,
                      splitFrom: shape.name || 'desconegut'
                    };
                    
                    setShapes(shapes.filter(s => s.id !== shape.id).concat([newPoly1, newPoly2]));
                  }
                  setSplitNodes([]);
                }
              }
            }
          }
        }
      } else {
        setSplitNodes([]);
      }
      return;
    }

    if (tool === 'circle' || tool === 'regularPolygon') {
      if (currentPoints.length === 0) {
        // Set center
        setCurrentPoints([{ x, y }]);
      } else {
        // Set radius and finish circle/polygon
        const center = currentPoints[0];
        const radiusPoint = { x, y };
        const radius = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
        
        if (tool === 'circle') {
          setShapes([...shapes, { 
            id: Date.now().toString(), 
            type: 'circle',
            points: [center, radiusPoint], 
            radius,
            closed: true,
            color: currentColor
          }]);
        } else {
          const angleOffset = Math.atan2(y - center.y, x - center.x);
          const points = [];
          for (let i = 0; i < regularPolygonSides; i++) {
            const angle = angleOffset + (i * 2 * Math.PI) / regularPolygonSides;
            points.push({
              x: center.x + radius * Math.cos(angle),
              y: center.y + radius * Math.sin(angle)
            });
          }
          
          setShapes([...shapes, { 
            id: Date.now().toString(), 
            type: 'polygon',
            points, 
            closed: true,
            center: { x: center.x, y: center.y },
            color: currentColor
          }]);
        }
        setCurrentPoints([]);
        setMousePos(null);
      }
      return;
    }

    if (tool === 'draw') {
      // Check if clicking near the first point to close the shape
      if (currentPoints.length >= 2) {
        const firstPoint = currentPoints[0];
        const dist = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
        
        if (dist < 15) {
          // Close shape
          setShapes([...shapes, { 
            id: Date.now().toString(), 
            type: 'polygon',
            points: currentPoints, 
            closed: true,
            color: currentColor
          }]);
          setCurrentPoints([]);
          setMousePos(null);
          return;
        }
      }

      setCurrentPoints([...currentPoints, { x, y }]);
    }
  };

  // Helper to check if a point is inside a polygon
  const isPointInPolygon = (point: Point, vs: Point[]) => {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      let xi = vs[i].x, yi = vs[i].y;
      let xj = vs[j].x, yj = vs[j].y;
      let intersect = ((yi > y) != (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Helper to check if a point is inside a circle
  const isPointInCircle = (point: Point, center: Point, radius: number) => {
    const dist = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
    return dist <= radius;
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      hasPannedRef.current = false;
      return;
    }

    if (tool !== 'select' && tool !== 'rotate' && tool !== 'info') return;
    
    isInteractingRef.current = false;

    const { x: rawX, y: rawY } = getCanvasPoint(e);
    let { x, y } = snapPoint({ x: rawX, y: rawY });

    let minDist = 10;
    for (const shape of shapes) {
      for (const p of shape.points) {
        const d = distance({x: rawX, y: rawY}, p);
        if (d < minDist) {
          minDist = d;
          x = p.x;
          y = p.y;
        }
      }
    }

    if (tool === 'info') {
      let clickedShapeId = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id; break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id; break;
            }
          } else {
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({ x, y }, shape.points[j], shape.points[j + 1]).distance < 10) {
                clickedShapeId = shape.id; break;
              }
            }
          }
        } else if (shape.type === 'point') {
          if (distance({ x, y }, shape.points[0]) < 10) {
            clickedShapeId = shape.id; break;
          }
        }
        if (clickedShapeId) break;
      }

      if (clickedShapeId) {
        const shape = shapes.find(s => s.id === clickedShapeId);
        if (shape) {
          addLog(`He demanat informació sobre l'objecte ${shape.name || 'desconegut'}`);
        }
      }
      return;
    }

    if (tool === 'rotate') {
      if (rotationState.center && rotationState.shapeId) {
        const R = 60;
        const hx = rotationState.center.x + R * Math.cos(rotationState.angle);
        const hy = rotationState.center.y + R * Math.sin(rotationState.angle);
        if (distance({x: rawX, y: rawY}, {x: hx, y: hy}) < 15) {
          const shape = shapes.find(s => s.id === rotationState.shapeId);
          if (shape) {
            const getDescendants = (parentId: string, allShapes: Shape[]): string[] => {
              const children = allShapes.filter(s => s.parentId === parentId).map(s => s.id);
              let descendants = [...children];
              for (const childId of children) {
                descendants = descendants.concat(getDescendants(childId, allShapes));
              }
              return descendants;
            };
            
            const descendants = getDescendants(shape.id, shapes);
            const shapesToRotate = new Set([shape.id, ...descendants]);
            
            const shapesState: { [id: string]: { originalPoints: Point[]; originalCenter?: Point } } = {};
            shapes.forEach(s => {
              if (shapesToRotate.has(s.id)) {
                shapesState[s.id] = { originalPoints: s.points, originalCenter: s.center };
              }
            });

            setDraggingRotation({
              shapesState,
              startMouseAngle: Math.atan2(rawY - rotationState.center.y, rawX - rotationState.center.x),
              startHandleAngle: rotationState.angle
            });
            isInteractingRef.current = true;
          }
          return;
        }
      }
      return;
    }

    let clickedShapeId = null;

    if (tool === 'select') {
      // Check for point label drag first
      for (const up of uniquePoints) {
        if (up.hidden) continue;
        const lx = up.p.x + up.offset.x;
        const ly = up.p.y + up.offset.y;
        const width = up.name.length * 9;
        const height = 14;
        
        if (x >= lx - 4 && x <= lx + width + 4 && y >= ly - height - 4 && y <= ly + 4) {
          setDraggingLabel({
            point: up.p,
            startOffset: up.offset,
            startX: x,
            startY: y
          });
          isInteractingRef.current = true;
          return;
        }
      }

      // Check for segment label drag
      for (const shape of shapes) {
        if (shape.segmentLabels) {
          for (const label of shape.segmentLabels) {
            const p1 = shape.points[label.index];
            const p2 = shape.points[(label.index + 1) % shape.points.length];
            if (p1 && p2) {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const lx = midX + label.offset.x;
              const ly = midY + label.offset.y;
              const width = label.name.length * 9;
              const height = 14;
              
              if (x >= lx - 4 && x <= lx + width + 4 && y >= ly - height - 4 && y <= ly + 4) {
                setDraggingSegmentLabel({
                  shapeId: shape.id,
                  index: label.index,
                  startOffset: label.offset,
                  startX: x,
                  startY: y
                });
                isInteractingRef.current = true;
                return;
              }
            }
          }
        }
      }

      // Check for name drag
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.name && (shape.showName || shape.type === 'angle')) {
          const nameOffset = shape.nameOffset || { x: 10, y: -10 };
          const textPos = shape.type === 'angle' && shape.points.length >= 2 ? shape.points[1] : shape.points[0];
          const textX = textPos.x + nameOffset.x;
          const textY = textPos.y + nameOffset.y;
          
          // Approximate bounding box for text
          const textWidth = shape.name.length * 7;
          const textHeight = 16;
          
          if (
            x >= textX && 
            x <= textX + textWidth && 
            y >= textY - textHeight && 
            y <= textY + 4
          ) {
            setDraggingName({
              shapeId: shape.id,
              offset: { x: x - textX, y: y - textY }
            });
            isInteractingRef.current = true;
            return;
          }
        }
      }
    }

    // Check for vertex drag first (higher priority)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      for (let j = 0; j < shape.points.length; j++) {
        const p = shape.points[j];
        const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
        if (dist < 10) {
          clickedShapeId = shape.id;
          
          const coincident: { shapeId: string; pointIndex: number }[] = [];
          for (const s of shapes) {
            for (let k = 0; k < s.points.length; k++) {
              if (Math.abs(s.points[k].x - p.x) < 0.001 && Math.abs(s.points[k].y - p.y) < 0.001) {
                coincident.push({ shapeId: s.id, pointIndex: k });
              }
            }
          }

          setDraggingVertex({ 
            primary: { shapeId: shape.id, pointIndex: j }, 
            coincident,
            moved: false 
          });
          isInteractingRef.current = true;
          break;
        }
      }
      if (clickedShapeId) break;
    }

    // Check for shape drag
    if (!clickedShapeId) {
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.type === 'circle' && shape.radius) {
          if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
            clickedShapeId = shape.id;
            setDraggingShape({ 
              shapeId: shape.id, 
              offset: { x: x - shape.points[0].x, y: y - shape.points[0].y },
              moved: false
            });
            isInteractingRef.current = true;
            break;
          }
        } else if (shape.type === 'polygon') {
          if (shape.closed) {
            if (isPointInPolygon({ x, y }, shape.points)) {
              clickedShapeId = shape.id;
              // Calculate offset relative to the first point
              setDraggingShape({ 
                shapeId: shape.id, 
                offset: { x: x - shape.points[0].x, y: y - shape.points[0].y },
                moved: false
              });
              isInteractingRef.current = true;
              break;
            }
          } else {
            let isNear = false;
            for (let j = 0; j < shape.points.length - 1; j++) {
              if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                isNear = true; break;
              }
            }
            if (isNear) {
              clickedShapeId = shape.id;
              setDraggingShape({ 
                shapeId: shape.id, 
                offset: { x: x - shape.points[0].x, y: y - shape.points[0].y },
                moved: false
              });
              isInteractingRef.current = true;
              break;
            }
          }
        }
      }
    }

    setSelectedShapeId(clickedShapeId);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && lastPanPos) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasPannedRef.current = true;
      }
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    const { x: rawX, y: rawY } = getCanvasPoint(e);
    let { x, y } = snapPoint({ x: rawX, y: rawY });

    if (!draggingShape && !draggingRotation) {
      let minDist = 10;
      for (const shape of shapes) {
        for (let i = 0; i < shape.points.length; i++) {
          const p = shape.points[i];
          // Don't snap to points we are currently dragging
          if (draggingVertex) {
            const isDragged = draggingVertex.coincident.some(c => c.shapeId === shape.id && c.pointIndex === i);
            if (isDragged) continue;
          }
          
          const d = distance({x: rawX, y: rawY}, p);
          if (d < minDist) {
            minDist = d;
            x = p.x;
            y = p.y;
          }
        }
      }
    }

    if (draggingLabel) {
      const dx = x - draggingLabel.startX;
      const dy = y - draggingLabel.startY;
      updatePointLabel(draggingLabel.point, {
        offset: {
          x: draggingLabel.startOffset.x + dx,
          y: draggingLabel.startOffset.y + dy
        }
      });
      return;
    }

    if (draggingSegmentLabel) {
      const dx = x - draggingSegmentLabel.startX;
      const dy = y - draggingSegmentLabel.startY;
      
      setShapes(shapes.map(s => {
        if (s.id === draggingSegmentLabel.shapeId && s.segmentLabels) {
          const newLabels = [...s.segmentLabels];
          const idx = newLabels.findIndex(l => l.index === draggingSegmentLabel.index);
          if (idx >= 0) {
            newLabels[idx] = { 
              ...newLabels[idx], 
              offset: { 
                x: draggingSegmentLabel.startOffset.x + dx, 
                y: draggingSegmentLabel.startOffset.y + dy 
              } 
            };
          }
          return { ...s, segmentLabels: newLabels };
        }
        return s;
      }));
      return;
    }

    if (draggingRotation && rotationState.center && rotationState.shapeId) {
      const currentMouseAngle = Math.atan2(rawY - rotationState.center.y, rawX - rotationState.center.x);
      let deltaAngle = currentMouseAngle - draggingRotation.startMouseAngle;
      
      const cos = Math.cos(deltaAngle);
      const sin = Math.sin(deltaAngle);
      const cx = rotationState.center.x;
      const cy = rotationState.center.y;
      
      setShapes(shapes.map(s => {
        const state = draggingRotation.shapesState[s.id];
        if (state) {
          const newPoints = state.originalPoints.map(p => ({
            x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
            y: cy + (p.x - cx) * sin + (p.y - cy) * cos
          }));
          
          let newCenter = s.center;
          if (newCenter && state.originalCenter) {
            newCenter = {
              x: cx + (state.originalCenter.x - cx) * cos - (state.originalCenter.y - cy) * sin,
              y: cy + (state.originalCenter.x - cx) * sin + (state.originalCenter.y - cy) * cos
            };
          }
          return { ...s, points: newPoints, center: newCenter };
        }
        return s;
      }));
      
      setRotationState({ ...rotationState, angle: draggingRotation.startHandleAngle + deltaAngle });
      return;
    }

    if (tool === 'addPoint' || tool === 'perpendicular' || (tool === 'parallel' && parallelState.step === 'select_edge')) {
      if (tool === 'addPoint' && addPointMode === 'standalone') {
        setHoveredEdge(null);
      } else {
        let closestEdge: { shapeId: string, insertIndex: number, point: Point, normal?: Point, p1?: Point, p2?: Point } | null = null;
        let minDist = 15;
        for (const shape of shapes) {
          if (shape.type === 'polygon') {
            const len = shape.closed ? shape.points.length : shape.points.length - 1;
            for (let i = 0; i < len; i++) {
              const p1 = shape.points[i];
              const p2 = shape.points[(i + 1) % shape.points.length];
              const distInfo = pointToSegmentDistance({x, y}, p1, p2);
              if (distInfo.distance < minDist) {
                minDist = distInfo.distance;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const length = Math.sqrt(dx*dx + dy*dy);
                const normal = length > 0 ? { x: -dy / length, y: dx / length } : { x: 0, y: 1 };
                
                if (tool === 'addPoint' && addPointMode === 'midpoint') {
                  closestEdge = { shapeId: shape.id, insertIndex: i + 1, point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, normal, p1, p2 };
                } else {
                  closestEdge = { shapeId: shape.id, insertIndex: i + 1, point: distInfo.point, normal, p1, p2 };
                }
              }
            }
          } else if (shape.type === 'circle' && shape.radius) {
            const distToCenter = distance({x, y}, shape.points[0]);
            const distToCircumference = Math.abs(distToCenter - shape.radius);
            if (distToCircumference < minDist) {
              minDist = distToCircumference;
              const angle = Math.atan2(y - shape.points[0].y, x - shape.points[0].x);
              const pointOnCircumference = {
                x: shape.points[0].x + shape.radius * Math.cos(angle),
                y: shape.points[0].y + shape.radius * Math.sin(angle)
              };
              const normal = { x: Math.cos(angle), y: Math.sin(angle) };
              closestEdge = { shapeId: shape.id, insertIndex: shape.points.length, point: pointOnCircumference, normal };
            }
          }
        }
        setHoveredEdge(closestEdge);
      }
    } else {
      if (hoveredEdge) setHoveredEdge(null);
    }

    if (draggingName) {
      setShapes(shapes.map(shape => {
        if (shape.id === draggingName.shapeId) {
          const textPos = shape.type === 'angle' && shape.points.length >= 2 ? shape.points[1] : shape.points[0];
          const newOffsetX = x - textPos.x - draggingName.offset.x;
          const newOffsetY = y - textPos.y - draggingName.offset.y;
          return { ...shape, nameOffset: { x: newOffsetX, y: newOffsetY } };
        }
        return shape;
      }));
      return;
    }

    if (draggingVertex) {
      setDraggingVertex(prev => prev ? { ...prev, moved: true } : null);
      
      const primaryShape = shapes.find(s => s.id === draggingVertex.primary.shapeId);
      if (!primaryShape) return;
      const oldP = primaryShape.points[draggingVertex.primary.pointIndex];
      const dx = x - oldP.x;
      const dy = y - oldP.y;

      setShapes(shapes.map(shape => {
        const draggedPointsForShape = draggingVertex.coincident.filter(c => c.shapeId === shape.id);
        
        if (draggedPointsForShape.length > 0) {
          const newPoints = [...shape.points];
          let newRadius = shape.radius;
          let needsRadiusUpdate = false;

          draggedPointsForShape.forEach(dp => {
            if (shape.type === 'circle' && dp.pointIndex >= 2 && shape.radius) {
              // Constrain extra points to circumference
              const center = shape.points[0];
              const angle = Math.atan2(y - center.y, x - center.x);
              newPoints[dp.pointIndex] = {
                x: center.x + shape.radius * Math.cos(angle),
                y: center.y + shape.radius * Math.sin(angle)
              };
            } else if (shape.type === 'circle' && dp.pointIndex === 0) {
              newPoints[0] = { x, y };
              if (newPoints.length > 1) {
                // Check if point 1 is also being dragged (coincident with center? unlikely but possible)
                const p1Dragged = draggedPointsForShape.some(c => c.pointIndex === 1);
                if (!p1Dragged) {
                  newPoints[1] = {
                    x: shape.points[1].x + dx,
                    y: shape.points[1].y + dy
                  };
                }
              }
              needsRadiusUpdate = true;
            } else {
              newPoints[dp.pointIndex] = { x, y };
              if (shape.type === 'circle' && dp.pointIndex < 2) {
                needsRadiusUpdate = true;
              }
            }
          });

          if (needsRadiusUpdate && shape.type === 'circle' && newPoints.length > 1) {
            const center = newPoints[0];
            newRadius = distance(center, newPoints[1]);
            
            // Update all other points to stay on the new circumference
            for (let i = 2; i < newPoints.length; i++) {
              const oldP = shape.points[i];
              const oldCenter = shape.points[0];
              const angle = Math.atan2(oldP.y - oldCenter.y, oldP.x - oldCenter.x);
              newPoints[i] = {
                x: center.x + newRadius * Math.cos(angle),
                y: center.y + newRadius * Math.sin(angle)
              };
            }
          }

          return { ...shape, points: newPoints, radius: newRadius };
        }
        return shape;
      }));
      return;
    }

    if (draggingShape) {
      setDraggingShape(prev => prev ? { ...prev, moved: true } : null);
      
      const getDescendants = (parentId: string, allShapes: Shape[]): string[] => {
        const children = allShapes.filter(s => s.parentId === parentId).map(s => s.id);
        let descendants = [...children];
        for (const childId of children) {
          descendants = descendants.concat(getDescendants(childId, allShapes));
        }
        return descendants;
      };

      const targetShape = shapes.find(s => s.id === draggingShape.shapeId);
      if (!targetShape) return;

      const dx = x - draggingShape.offset.x - targetShape.points[0].x;
      const dy = y - draggingShape.offset.y - targetShape.points[0].y;
      
      const descendants = getDescendants(draggingShape.shapeId, shapes);
      const shapesToMove = new Set([draggingShape.shapeId, ...descendants]);

      setShapes(shapes.map(shape => {
        if (shapesToMove.has(shape.id)) {
          const newPoints = shape.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
          }));
          const newCenter = shape.center ? { x: shape.center.x + dx, y: shape.center.y + dy } : undefined;
          return { ...shape, points: newPoints, center: newCenter };
        }
        return shape;
      }));
      return;
    }

    if (tool === 'select' || tool === 'info') {
      // Check hover state for cursor change
      let foundHover = false;
      
      // Check point label hover
      for (const up of uniquePoints) {
        if (up.hidden) continue;
        const lx = up.p.x + up.offset.x;
        const ly = up.p.y + up.offset.y;
        const width = up.name.length * 9;
        const height = 14;
        
        if (x >= lx - 4 && x <= lx + width + 4 && y >= ly - height - 4 && y <= ly + 4) {
          setHoveredShape('shape');
          foundHover = true;
          break;
        }
      }

      // Check name hover
      if (!foundHover) {
        for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.name && (shape.showName || shape.type === 'angle')) {
          const nameOffset = shape.nameOffset || { x: 10, y: -10 };
          const textPos = shape.type === 'angle' && shape.points.length >= 2 ? shape.points[1] : shape.points[0];
          const textX = textPos.x + nameOffset.x;
          const textY = textPos.y + nameOffset.y;
          const textWidth = shape.name.length * 7;
          const textHeight = 16;
          
          if (
            x >= textX && 
            x <= textX + textWidth && 
            y >= textY - textHeight && 
            y <= textY + 4
          ) {
            setHoveredShape('shape');
            foundHover = true;
            break;
          }
        }
      }
      }

      // Check vertices first
      if (!foundHover) {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          for (let j = 0; j < shape.points.length; j++) {
            const p = shape.points[j];
            const dist = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
            if (dist < 10) {
              setHoveredShape('vertex');
              foundHover = true;
              break;
            }
          }
          if (foundHover) break;
        }
      }

      // Check shapes
      if (!foundHover) {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (shape.type === 'circle' && shape.radius) {
            if (isPointInCircle({ x, y }, shape.points[0], shape.radius)) {
              setHoveredShape('shape');
              foundHover = true;
              break;
            }
          } else if (shape.type === 'polygon') {
            if (shape.closed) {
              if (isPointInPolygon({ x, y }, shape.points)) {
                setHoveredShape('shape');
                foundHover = true;
                break;
              }
            } else {
              let isNear = false;
              for (let j = 0; j < shape.points.length - 1; j++) {
                if (pointToSegmentDistance({x, y}, shape.points[j], shape.points[j+1]).distance < 10) {
                  isNear = true; break;
                }
              }
              if (isNear) {
                setHoveredShape('shape');
                foundHover = true;
                break;
              }
            }
          }
        }
      }

      if (!foundHover) {
        setHoveredShape(null);
      }
    } else if (tool === 'rotate') {
      if (rotationState.center && rotationState.shapeId) {
        const R = 60;
        const hx = rotationState.center.x + R * Math.cos(rotationState.angle);
        const hy = rotationState.center.y + R * Math.sin(rotationState.angle);
        if (distance({x: rawX, y: rawY}, {x: hx, y: hy}) < 15) {
          setHoveredShape('vertex');
        } else {
          setHoveredShape(null);
        }
      } else {
        setHoveredShape(null);
      }
    } else {
      if (hoveredShape) setHoveredShape(null);
    }

    setMousePos({ x, y });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPos(null);
      return;
    }

    if (draggingLabel) {
      setDraggingLabel(null);
      isInteractingRef.current = false;
      return;
    }
    if (draggingSegmentLabel) {
      setDraggingSegmentLabel(null);
      isInteractingRef.current = false;
      return;
    }
    if (draggingName) {
      setDraggingName(null);
    }
    if (draggingVertex) {
      if (draggingVertex.moved) {
        const shape = shapes.find(s => s.id === draggingVertex.primary.shapeId);
        if (shape) addLog(`He modificat un vèrtex de l'objecte ${shape.name || 'desconegut'}`);
      }
      setDraggingVertex(null);
    }
    if (draggingShape) {
      if (draggingShape.moved) {
        const shape = shapes.find(s => s.id === draggingShape.shapeId);
        if (shape) addLog(`He mogut l'objecte ${shape.name || 'desconegut'}`);
      }
      setDraggingShape(null);
    }
    if (draggingRotation) {
      const shape = shapes.find(s => s.id === rotationState.shapeId);
      if (shape) {
        const degrees = Math.round((rotationState.angle - draggingRotation.startHandleAngle) * 180 / Math.PI);
        if (degrees !== 0) {
          addLog(`He rotat ${degrees}º l'objecte ${shape.name || 'desconegut'}`);
        }
      }
      setDraggingRotation(null);
      setTool('select');
    }
    if (draggingPerpendicular) {
      if (mousePos) {
        const v = { x: mousePos.x - draggingPerpendicular.startPoint.x, y: mousePos.y - draggingPerpendicular.startPoint.y };
        const dot = v.x * draggingPerpendicular.normal.x + v.y * draggingPerpendicular.normal.y;
        
        if (Math.abs(dot) > 5) {
          const endPoint = {
            x: draggingPerpendicular.startPoint.x + dot * draggingPerpendicular.normal.x,
            y: draggingPerpendicular.startPoint.y + dot * draggingPerpendicular.normal.y
          };
          
          setShapes([...shapes, {
            id: Date.now().toString(),
            type: 'polygon',
            points: [draggingPerpendicular.startPoint, endPoint],
            closed: false,
            parentId: draggingPerpendicular.shapeId,
            isPerpendicular: true
          }]);
          addLog(`He fet una perpendicular`);
        }
      }
      setDraggingPerpendicular(null);
    }
  };

  const handleContextMenu = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Right click to finish open shape
    if (hasPannedRef.current) {
      hasPannedRef.current = false;
      return;
    }
    if (tool === 'draw' && currentPoints.length > 1) {
      setShapes([...shapes, { 
        id: Date.now().toString(), 
        type: 'polygon',
        points: currentPoints, 
        closed: false,
        color: currentColor
      }]);
    }
    setCurrentPoints([]);
    setMousePos(null);
  };

  const handleTextSubmit = () => {
    if (!textPrompt) return;
    if (textInputValue.trim() !== "") {
      const textShape: Shape = {
        id: Date.now().toString() + 'text',
        type: 'text',
        points: [textPrompt.point],
        closed: false,
        text: textInputValue,
        color: currentColor
      };
      setShapes([...shapes, textShape]);
      addLog(`He afegit el text: "${textInputValue}"`);
    }
    setTextPrompt(null);
    setTextInputValue("");
  };

  const handleScaleSubmit = () => {
    if (!scalePrompt) return;
    
    const scaleFactor = parseFloat(scaleInputValue);
    if (isNaN(scaleFactor) || scaleFactor <= 0) {
      addLog("Factor d'escala invàlid");
      setScalePrompt(null);
      return;
    }

    const shapeToScale = shapes.find(s => s.id === scalePrompt.shapeId);
    if (!shapeToScale) {
      setScalePrompt(null);
      return;
    }

    // Calculate center of the shape
    let cx = 0, cy = 0;
    if (shapeToScale.type === 'circle') {
      cx = shapeToScale.points[0].x;
      cy = shapeToScale.points[0].y;
    } else {
      shapeToScale.points.forEach(p => { cx += p.x; cy += p.y; });
      cx /= shapeToScale.points.length;
      cy /= shapeToScale.points.length;
    }

    const newPoints = shapeToScale.points.map(p => ({
      x: cx + (p.x - cx) * scaleFactor,
      y: cy + (p.y - cy) * scaleFactor
    }));

    const newShape: Shape = {
      ...shapeToScale,
      id: Date.now().toString(),
      points: newPoints,
      name: undefined,
      showName: false,
      parentId: shapeToScale.id
    };

    if (shapeToScale.type === 'circle' && shapeToScale.radius) {
      newShape.radius = shapeToScale.radius * scaleFactor;
    }

    setShapes([...shapes, newShape]);
    addLog(`He escalat l'objecte ${shapeToScale.name || 'desconegut'} amb factor ${scaleFactor}`);
    setScalePrompt(null);
  };

  const handleAmplitudeSubmit = () => {
    if (!amplitudePrompt) return;
    const amplitude = parseFloat(amplitudeInputValue);
    if (isNaN(amplitude)) {
      addLog("Amplitud invàlida");
      setAmplitudePrompt(null);
      setAnglePoints([]);
      return;
    }
    
    const { p1, p2 } = amplitudePrompt;
    const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
    const rad = amplitude * Math.PI / 180;
    const newAngle = angle1 + rad;
    
    const dist = distance(p1, p2);
    const p3 = {
      x: p2.x + dist * Math.cos(newAngle),
      y: p2.y + dist * Math.sin(newAngle)
    };
    
    const fullPoints = [p1, p2, p3];
    
    const angleShape: Shape = {
      id: Date.now().toString() + 'angle',
      type: 'angle',
      points: fullPoints,
      closed: false,
      name: `${amplitude.toFixed(1)}°`,
      nameOffset: { x: 20, y: -20 },
      color: currentColor
    };
    
    // Also draw the segments for the new angle so it's visible
    const lineShape1: Shape = {
      id: Date.now().toString() + 'line1',
      type: 'polygon',
      points: [p1, p2],
      closed: false,
      color: currentColor
    };
    const lineShape2: Shape = {
      id: Date.now().toString() + 'line2',
      type: 'polygon',
      points: [p2, p3],
      closed: false,
      color: currentColor
    };
    
    setShapes([...shapes, lineShape1, lineShape2, angleShape]);
    addLog(`He fet un angle de ${amplitude}°`);
    setAnglePoints([]);
    setAmplitudePrompt(null);
  };

  const handleClear = () => {
    setShapes([]);
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    if (currentPoints.length > 0) {
      setCurrentPoints(currentPoints.slice(0, -1));
    } else if (shapes.length > 0) {
      setShapes(shapes.slice(0, -1));
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newZoom = direction > 0 ? zoom * zoomFactor : zoom / zoomFactor;
    
    // Limit zoom
    if (newZoom < 0.1 || newZoom > 10) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate new pan to keep mouse position fixed
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-200 bg-white flex items-center px-4 shadow-sm z-10 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2">
          {/* Group 1: Select / Point */}
          <button
            onClick={() => { setTool('select'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'select' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Seleccionar i moure"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <div className="relative flex items-center">
            <button
              onClick={() => { setTool('addPoint'); setCurrentPoints([]); setSplitNodes([]); }}
              className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                tool === 'addPoint' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
              }`}
              title="Afegir punt"
            >
              <PointIcon className="w-4 h-4" />
            </button>
            {tool === 'addPoint' && (
              <select
                value={addPointMode}
                onChange={(e) => setAddPointMode(e.target.value as any)}
                className="h-8 px-2 text-sm border border-slate-200 rounded-md ml-1 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                title="Mode de punt"
              >
                <option value="standalone">Punt solitari</option>
                <option value="edge">Punt en un costat</option>
                <option value="midpoint">Punt mig d'un costat</option>
              </select>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 2: Draw / Circle / Regular Polygon / Split / Merge */}
          <button
            onClick={() => { setTool('draw'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'draw' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Clic botó dret per aturar"
          >
            <IrregularPolygonIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('circle'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'circle' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Dibuixa cercles"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('regularPolygon'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'regularPolygon' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Dibuixa polígons regulars"
          >
            <Hexagon className="w-4 h-4" />
          </button>
          {tool === 'regularPolygon' && (
            <input
              type="number"
              min="3"
              max="20"
              value={regularPolygonSides}
              onChange={(e) => setRegularPolygonSides(Math.max(3, parseInt(e.target.value) || 3))}
              className="w-16 h-8 px-2 text-sm border border-slate-200 rounded-md ml-1"
              title="Nombre de costats"
            />
          )}
          <button
            onClick={() => { setTool('split'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'split' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Descompondre"
          >
            <Scissors className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('merge'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'merge' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Compondre"
          >
            <Combine className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 3: Perpendicular / Parallel / Angle */}
          <button
            onClick={() => { setTool('perpendicular'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'perpendicular' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Dibuixar perpendicular"
          >
            <PerpendicularIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('parallel'); setCurrentPoints([]); setSplitNodes([]); setParallelState({ step: 'select_edge', edge: null }); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'parallel' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Dibuixar paral·lela: selecciona una recta, click on vols posar la seva paral·lela"
          >
            <ParallelIcon className="w-4 h-4" />
          </button>
          <div className="relative flex items-center">
            <button
              onClick={() => { setTool('angle'); setCurrentPoints([]); setSplitNodes([]); setAnglePoints([]); }}
              className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                tool === 'angle' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
              }`}
              title="Angles"
            >
              <AngleIcon className="w-4 h-4" />
            </button>
            {tool === 'angle' && (
              <select
                value={angleMode}
                onChange={(e) => {
                  setAngleMode(e.target.value as 'measure' | 'amplitude');
                  setAnglePoints([]);
                }}
                className="h-8 px-2 text-sm border border-slate-200 rounded-md ml-1 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                title="Mode d'angle"
              >
                <option value="measure">Mesurar un angle</option>
                <option value="amplitude">Amplitud d'un angle nou</option>
              </select>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 4: Rotate / Symmetry */}
          <button
            onClick={() => { setTool('rotate'); setCurrentPoints([]); setSplitNodes([]); setRotationState({ center: null, shapeId: null, angle: 0 }); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'rotate' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Rotar objecte"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('scale'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'scale' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Escalar objecte"
          >
            <Maximize className="w-4 h-4" />
          </button>
          <div className="relative flex items-center">
            <button
              onClick={() => { setTool('symmetry'); setCurrentPoints([]); setSplitNodes([]); setSymmetryState({ step: 'select_shape', shapeId: null }); }}
              className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                tool === 'symmetry' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
              }`}
              title="Simetria"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            {tool === 'symmetry' && (
              <select
                value={symmetryMode}
                onChange={(e) => { setSymmetryMode(e.target.value as any); setSymmetryState({ step: 'select_shape', shapeId: null }); }}
                className="h-8 px-2 text-sm border border-slate-200 rounded-md ml-1 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                title="Tipus de simetria"
              >
                <option value="axial">Axial</option>
                <option value="central">Central</option>
              </select>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 5: Copy / Erase / Undo / Clear */}
          <button
            onClick={() => { setTool('copy'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'copy' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Copiar figura"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('erase'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'erase' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Esborrar objectes"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={handleUndo}
            disabled={shapes.length === 0 && currentPoints.length === 0}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Desfer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Netejar Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 6: Text / Label / Info */}
          <button
            onClick={() => { setTool('text'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'text' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Escriure text"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('label'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'label' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Posar lletres/noms (Aa)"
          >
            <Baseline className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTool('info'); setCurrentPoints([]); setSplitNodes([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              tool === 'info' ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Informació de la figura"
          >
            <Info className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

          {/* Group 7: Grid / Colors / Zoom */}
          <button
            onClick={() => setGridEnabled(!gridEnabled)}
            className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              gridEnabled ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title="Quadricular (50x50)"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setCurrentColor(c.value)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  currentColor === c.value ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
          className={`absolute top-0 left-0 w-full h-full ${
            isPanning ? 'cursor-grabbing' :
            (draggingVertex || draggingShape || draggingLabel) 
              ? 'cursor-grabbing' 
              : hoveredShape === 'vertex'
                ? 'cursor-grab'
                : hoveredShape === 'shape'
                  ? 'cursor-pointer'
                  : tool === 'rotate'
                    ? 'cursor-[url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMnY3YTIgMiAwIDAgMS0yIDJIMTVtLTMgMGgtM20tMyAwaC0zYTIgMiAwIDAgMS0yLTJ2LTdtMC0zaDBtMC0zaDBtMC0zaDBtMyAwaDNtMyAwaDNtMyAwaDNhMiAyIDAgMCAxIDIgMnYzbS0zLTNsMy0zbTMgM2wtMyAzIi8+PC9zdmc+KSwgYXV0bw==]'
                    : 'cursor-crosshair'
          }`}
        />
        
        {/* Helper text overlay removed */}

        {/* Amplitude Prompt Overlay */}
        {amplitudePrompt && (
          <div 
            className="absolute bg-white p-2 rounded-lg shadow-lg border border-slate-200 flex items-center gap-2 z-50 transform -translate-x-1/2 -translate-y-full mt-[-10px]"
            style={{ left: amplitudePrompt.p2.x, top: amplitudePrompt.p2.y }}
          >
            <input 
              type="number" 
              value={amplitudeInputValue} 
              onChange={e => setAmplitudeInputValue(e.target.value)}
              className="w-16 h-8 px-2 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAmplitudeSubmit();
                } else if (e.key === 'Escape') {
                  setAmplitudePrompt(null);
                  setAnglePoints([]);
                }
              }}
            />
            <span className="text-sm font-medium text-slate-700">°</span>
            <button 
              onClick={handleAmplitudeSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              OK
            </button>
          </div>
        )}

        {/* Text Prompt Overlay */}
        {textPrompt && (
          <div 
            className="absolute bg-white p-2 rounded-lg shadow-lg border border-slate-200 flex items-center gap-2 z-50 transform -translate-x-1/2 -translate-y-full mt-[-10px]"
            style={{ left: textPrompt.point.x, top: textPrompt.point.y }}
          >
            <input 
              type="text" 
              value={textInputValue} 
              onChange={e => setTextInputValue(e.target.value)}
              className="w-48 h-8 px-2 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Escriu un text..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleTextSubmit();
                } else if (e.key === 'Escape') {
                  setTextPrompt(null);
                  setTextInputValue("");
                }
              }}
            />
            <button 
              onClick={handleTextSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              OK
            </button>
          </div>
        )}

        {/* Scale Prompt Overlay */}
        {scalePrompt && (
          <div 
            className="absolute bg-white p-2 rounded-lg shadow-lg border border-slate-200 flex items-center gap-2 z-50 transform -translate-x-1/2 -translate-y-full mt-[-10px]"
            style={{ left: scalePrompt.position.x, top: scalePrompt.position.y }}
          >
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Factor d'escala:</label>
            <input 
              type="number" 
              step="0.1"
              min="0.1"
              value={scaleInputValue} 
              onChange={e => setScaleInputValue(e.target.value)}
              className="w-20 h-8 px-2 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleScaleSubmit();
                } else if (e.key === 'Escape') {
                  setScalePrompt(null);
                }
              }}
            />
            <button 
              onClick={handleScaleSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
