import React, { useEffect, useState, useRef } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useParams,
  useHistory,
} from 'react-router-dom';

type Requirement = {
  id: string;
  text: string;
  portId?: string; // if undefined, requirement is for the block itself
};

type Port = {
  id: string;
  name?: string;
  side?: 'left' | 'right';
  x?: number;
  y?: number;
  target?: { blockId: string; portId: string } | null;
};

type Block = {
  id: string;
  name: string;
  x?: number;
  y?: number;
  ports?: Port[];
  requirements?: Requirement[];
  subblocks?: Block[]; // optional container for grouping
};

type Diagram = { id: string; name: string; blocks: Block[] };

async function api<T>(path: string, opts?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());

  // handle empty responses (204 No Content) and non-JSON safely
  const text = await res.text();
  if (!text) return null as any;
  try {
    return JSON.parse(text) as T;
  } catch {
    // fallback: return raw text for non-JSON endpoints
    return text as any;
  }
}

function DiagramList() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const history = useHistory();

  async function load() {
    try {
      const list = await api<Diagram[]>('/api/diagrams');
      setDiagrams(list);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const name = `Diagram ${Date.now()}`;
    try {
      const created = await api<Diagram>('/api/diagrams', {
        method: 'POST',
        body: JSON.stringify({ name, blocks: [] }),
      });
      console.log('diagram created:', created);
      history.push(`/diagram/${created.id}`);
    } catch (err) {
      console.error('Failed to create diagram:', err);
      alert('Failed to create diagram — see console for details.');
    }
  }

    async function deleteDiagram(id: string) {
    if (!window.confirm('Delete this diagram?')) return;
    try {
        // 1. Attempt to delete the diagram via API
        await api(`/api/diagrams/${id}`, { method: 'DELETE' });
        
        // 2. ONLY if deletion succeeds, attempt to reload the list
        await load();
        
    } catch (err) {
        // 3. ONLY if the API call in step 1 or the load in step 2 fails, show the error
        console.error('Failed to delete diagram:', err);
        alert('Failed to delete diagram.');
    }
    }

  return (
    <div style={{ padding: 20 }}>
      <h1>Diagrams</h1>
      <button onClick={create}>New Diagram</button>
      <ul>
        {diagrams.map(d => (
          <li key={d.id} style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Link to={`/diagram/${d.id}`}>{d.name}</Link>
            <button onClick={() => deleteDiagram(d.id)} style={{ color: 'darkred' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagramCanvas({
  diagram,
  onUpdate,
}: {
  diagram: Diagram;
  onUpdate: (d: Diagram) => void;
}) {
  const [local, setLocal] = useState<Diagram>(diagram);
  useEffect(() => setLocal(diagram), [diagram]);

  const [viewStack, setViewStack] = useState<
    { blocks: Block[]; parentBlockId: string | null }[]
  >([{ blocks: diagram.blocks, parentBlockId: null }]);

  // NOTE: removed the previous effect that reset viewStack on local.blocks changes.
  // keep viewStack stable while editing / dragging inside subviews.

  const view = viewStack[viewStack.length - 1];
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Record<string, boolean>>({});
  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [pendingConn, setPendingConn] = useState<{ blockId: string; portId: string } | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [showReqs, setShowReqs] = useState(false);

  // refs used for robust dragging (works across subviews and outside svg)
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    draggingRef.current = draggingBlockId;
  }, [draggingBlockId]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensurePorts(b: Block) {
    if (!Array.isArray(b.ports)) b.ports = [];
    return b.ports!;
  }

  function ensureRequirements(b: Block) {
    if (!Array.isArray(b.requirements)) b.requirements = [];
    return b.requirements!;
  }

  function findBlockRecursive(id: string, blocks?: Block[]): Block | null {
    const list = blocks ?? local.blocks;
    for (const b of list) {
      if (b.id === id) return b;
      if (Array.isArray(b.subblocks)) {
        const found = findBlockRecursive(id, b.subblocks);
        if (found) return found;
      }
    }
    return null;
  }

  // layout constants for subblock view
  const SUB_VIEW_BOX = { x: 40, y: 40, padding: 16 }; // box position & inner padding

  // compute block size based on number of left/right ports (height grows)
  function blockSize(b: Block) {
    const ports = ensurePorts(b);
    const leftCount = ports.filter(p => p.side === 'left').length;
    const rightCount = ports.filter(p => p.side === 'right').length;
    const maxPorts = Math.max(leftCount, rightCount, 1);
    const height = Math.max(60, 16 + maxPorts * 18); // room per port
    const width = 160; // keep width fixed for now (can expand later for labels)
    return { width, height };
  }

  // normalize ports but keep order (no side-mixing)
  function normalizePorts(b: Block) {
    const ports = ensurePorts(b);
    return ports.map((p, i) => ({ id: p.id ?? `${b.id}-p${i}`, side: p.side ?? 'right', ...p }));
  }

  // compute port position. distribute left and right separately using side-specific lists.
  function portPos(b: Block, p: Port) {
    const bx = (b.x ?? 40);
    const by = (b.y ?? 20);
    const size = blockSize(b);
    const width = size.width;
    const height = size.height;

    const ports = normalizePorts(b);
    const leftPorts = ports.filter(pp => pp.side === 'left');
    const rightPorts = ports.filter(pp => pp.side === 'right');

    const topMargin = 10;
    const bottomMargin = 10;
    const availableHeight = Math.max(20, height - topMargin - bottomMargin);

    if (p.side === 'left') {
      const idx = leftPorts.findIndex(pp => pp.id === p.id);
      const spacing = leftPorts.length > 1 ? availableHeight / (leftPorts.length - 1) : availableHeight / 2;
      const py = by + topMargin + idx * spacing;
      const px = bx - 8; // slightly outside left edge
      return { x: px, y: py };
    } else {
      const idx = rightPorts.findIndex(pp => pp.id === p.id);
      const spacing = rightPorts.length > 1 ? availableHeight / (rightPorts.length - 1) : availableHeight / 2;
      const py = by + topMargin + idx * spacing;
      const px = bx + width + 8; // slightly outside right edge
      return { x: px, y: py };
    }
  }

  // compute view offsets when inside a subblock so children and parent-edge ports align inside a visible box
  function getViewBox() {
    const svgRect = svgRef.current?.getBoundingClientRect();
    const svgW = Math.max(300, svgRect?.width ?? 800);
    const svgH = Math.max(420, svgRect?.height ?? 400);
    const boxX = SUB_VIEW_BOX.x;
    const boxY = SUB_VIEW_BOX.y;
    const boxW = svgW - boxX * 2;
    const boxH = svgH - boxY * 2;
    const innerOffset = { x: boxX + SUB_VIEW_BOX.padding, y: boxY + SUB_VIEW_BOX.padding };
    return { svgW, svgH, box: { x: boxX, y: boxY, w: boxW, h: boxH }, innerOffset };
  }

  // findPortPos: returns absolute coordinates in SVG space for any port (in-view, parent-edge, or root)
  function findPortPos(blockId: string, portId: string) {
    // when viewing inside a subblock and asking for the parent block's ports -> place at box inner edges (not floating)
    if (view.parentBlockId && blockId === view.parentBlockId) {
      const parent = findBlockRecursive(blockId);
      if (!parent || !parent.ports) return null;
      const ports = normalizePorts(parent);
      const p = ports.find(pp => pp.id === portId) || ports[0];
      const { box, innerOffset } = getViewBox();

      const leftPorts = ports.filter(pp => pp.side === 'left');
      const rightPorts = ports.filter(pp => pp.side === 'right');
      const top = innerOffset.y;
      const available = Math.max(40, box.h - SUB_VIEW_BOX.padding * 2);
      if (p.side === 'left') {
        const idx = leftPorts.findIndex(pp => pp.id === p.id);
        const spacing = leftPorts.length > 1 ? available / (leftPorts.length - 1) : available / 2;
        const x = innerOffset.x; // inside left edge
        const y = top + idx * spacing;
        return { x, y };
      } else {
        const idx = rightPorts.findIndex(pp => pp.id === p.id);
        const spacing = rightPorts.length > 1 ? available / (rightPorts.length - 1) : available / 2;
        const x = innerOffset.x + box.w - SUB_VIEW_BOX.padding * 2; // inside right edge
        const y = top + idx * spacing;
        return { x, y };
      }
    }

    // current view blocks: compute pos and then offset by innerOffset when inside subview
    const inView = (view.blocks || []).find(x => x.id === blockId);
    if (inView) {
      const p = normalizePorts(inView).find((pp: any) => pp.id === portId) || normalizePorts(inView)[0];
      const pos = portPos(inView, p);
      if (view.parentBlockId) {
        const { innerOffset } = getViewBox();
        return { x: pos.x + innerOffset.x, y: pos.y + innerOffset.y };
      }
      return pos;
    }

    // fallback: find in root (global coordinates)
    const rootBlock = findBlockRecursive(blockId);
    if (rootBlock) {
      const p = normalizePorts(rootBlock).find((pp: any) => pp.id === portId) || normalizePorts(rootBlock)[0];
      return portPos(rootBlock, p);
    }
    return null;
  }

  function updateTopLevelBlocks(updatedBlocks: Block[]) {
    const updated = { ...local, blocks: updatedBlocks };
    setLocal(updated);
    onUpdate(updated);
    // update only top-level entry in viewStack to keep nested view preserved
    setViewStack(prev => prev.map((v, i) => (i === 0 ? { ...v, blocks: updatedBlocks } : v)));
  }

  function updateBlockInView(updated: Block) {
    const blocks = view.blocks.map(b => (b.id === updated.id ? updated : b));
    replaceTopViewBlocks(blocks);
    if (view.parentBlockId === null) updateTopLevelBlocks(blocks);
    else {
      // update parent block's subblocks in the root, without resetting viewStack
      const rootBlocks = local.blocks.map(b => {
        if (b.id === view.parentBlockId) {
          return { ...b, subblocks: blocks };
        }
        return b;
      });
      // persist to local and api
      updateTopLevelBlocks(rootBlocks);
    }
  }

  function replaceTopViewBlocks(blocks: Block[]) {
    setViewStack(prev => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], blocks };
      return copy;
    });
  }

  // block click: allow ctrl-click to multi-select, otherwise select single and open editor area
  function onBlockClick(e: React.MouseEvent, b: Block) {
    // clicking a child should not change view
    if (e.ctrlKey || e.metaKey) {
      setSelectedBlocks(prev => ({ ...prev, [b.id]: !prev[b.id] }));
      return;
    }
    setSelectedBlockId(b.id);
    setSelectedBlocks({});
    setEditingPortId(null);
  }

  // robust dragging using window events and svg-relative coords; take view offset into account
  function getSvgCoord(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onBlockMouseDown(e: React.MouseEvent, b: Block) {
    if (e.button !== 0) return;
    e.stopPropagation();
    setDraggingBlockId(b.id);
    draggingRef.current = b.id;

    const svgPoint = getSvgCoord(e.clientX, e.clientY);

    // compute rendered block position (including view offset if inside subview)
    const idx = view.blocks.findIndex(bb => bb.id === b.id);
    const baseX = b.x ?? (40 + (idx >= 0 ? idx * 30 : 0));
    const baseY = b.y ?? (20 + (idx >= 0 ? idx * 90 : 0));
    const viewOffset = view.parentBlockId ? getViewBox().innerOffset : { x: 0, y: 0 };
    const renderedBx = baseX + viewOffset.x;
    const renderedBy = baseY + viewOffset.y;

    dragOffsetRef.current = { x: svgPoint.x - renderedBx, y: svgPoint.y - renderedBy };

    // attach global listeners
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }

  function onWindowMouseMove(e: MouseEvent) {
    const draggingId = draggingRef.current;
    if (!draggingId) return;
    const b = view.blocks.find(bb => bb.id === draggingId);
    if (!b) return;
    const svgPoint = getSvgCoord(e.clientX, e.clientY);
    const viewOffset = view.parentBlockId ? getViewBox().innerOffset : { x: 0, y: 0 };

    // new rendered position then convert back to block-local coordinates
    const newRenderedX = svgPoint.x - dragOffsetRef.current.x;
    const newRenderedY = svgPoint.y - dragOffsetRef.current.y;
    const newLocalX = Math.max(0, newRenderedX - viewOffset.x);
    const newLocalY = Math.max(0, newRenderedY - viewOffset.y);

    const updated: Block = { ...b, x: newLocalX, y: newLocalY };
    const blocks = view.blocks.map(bb => (bb.id === updated.id ? updated : bb));
    replaceTopViewBlocks(blocks);

    // persist updated positions but avoid resetting view stack (updateTopLevelBlocks preserves viewStack)
    if (view.parentBlockId === null) updateTopLevelBlocks(blocks);
    else {
      const rootBlocks = local.blocks.map(rootB => (rootB.id === view.parentBlockId ? { ...rootB, subblocks: blocks } : rootB));
      updateTopLevelBlocks(rootBlocks);
    }
  }

  function onWindowMouseUp() {
    setDraggingBlockId(null);
    draggingRef.current = null;
    window.removeEventListener('mousemove', onWindowMouseMove);
    window.removeEventListener('mouseup', onWindowMouseUp);
  }

  // add/remove blocks in current view
  function addBlockHere() {
    const id = `b${Date.now()}`;
    const maxY = view.blocks.length > 0 ? Math.max(...view.blocks.map(b => (b.y ?? 20) + 70)) : 20;
    const newBlock: Block = { id, name: 'New Block', x: 40, y: maxY + 20, ports: [], requirements: [] };
    const blocks = [...view.blocks, newBlock];
    replaceTopViewBlocks(blocks);
    if (view.parentBlockId === null) updateTopLevelBlocks(blocks);
    else {
      const root = local.blocks.map(b => (b.id === view.parentBlockId ? { ...b, subblocks: blocks } : b));
      updateTopLevelBlocks(root);
    }
    setSelectedBlockId(id);
  }

  // port operations
  function addPort(blockId: string, side: 'left' | 'right' = 'right') {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b) return;
    const pid = `${blockId}-p${Date.now()}`;
    b.ports = [...(b.ports ?? []), { id: pid, name: 'port', side } as Port];
    updateBlockInView({ ...b });
  }
  function removePort(blockId: string, portId: string) {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b || !b.ports) return;
    b.ports = b.ports.filter(p => p.id !== portId);
    updateBlockInView({ ...b });
  }
  function editPort(blockId: string, portId: string, changes: Partial<Port>) {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b || !b.ports) return;
    b.ports = b.ports.map(p => (p.id === portId ? { ...p, ...changes } : p));
    updateBlockInView({ ...b });
  }

  // requirement operations
  function addRequirement(blockId: string, portId?: string) {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b) return;
    const reqs = ensureRequirements(b);
    reqs.push({ id: `req${Date.now()}`, text: 'New requirement', portId });
    updateBlockInView({ ...b, requirements: reqs });
  }
  function removeRequirement(blockId: string, reqId: string) {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b) return;
    b.requirements = (b.requirements ?? []).filter(r => r.id !== reqId);
    updateBlockInView({ ...b });
  }
  function editRequirement(blockId: string, reqId: string, text: string) {
    const b = view.blocks.find(bb => bb.id === blockId);
    if (!b) return;
    b.requirements = (b.requirements ?? []).map(r => (r.id === reqId ? { ...r, text } : r));
    updateBlockInView({ ...b });
  }

  // connect by click: click "Start connect" on a source port, then click a target port (any block)
  function startConnect(blockId: string, portId: string) {
    setPendingConn({ blockId, portId });
  }
  function clickPortToConnect(targetBlockId: string, targetPortId: string) {
    if (!pendingConn) return;
    // do not allow connecting to self same port
    if (pendingConn.blockId === targetBlockId && pendingConn.portId === targetPortId) {
      setPendingConn(null);
      return;
    }
    // set source port's target -- if source is not in current view, attempt to update its owner
    const srcBlock = view.blocks.find(b => b.id === pendingConn.blockId) || findBlockRecursive(pendingConn.blockId);
    if (!srcBlock || !srcBlock.ports) { setPendingConn(null); return; }
    srcBlock.ports = srcBlock.ports.map(p =>
      p.id === pendingConn.portId ? { ...p, target: { blockId: targetBlockId, portId: targetPortId } } : p
    );
    // persist change in whichever level the source belongs to
    if (view.blocks.some(bb => bb.id === srcBlock.id)) updateBlockInView({ ...srcBlock });
    else {
      // search and update in root
      const updatedRoot = local.blocks.map(b => (b.id === srcBlock.id ? srcBlock : b));
      updateTopLevelBlocks(updatedRoot);
    }
    setPendingConn(null);
  }

  // grouping: create a group from selectedBlocks -> newBlock that contains subblocks
  function groupSelectedIntoSubblock() {
    const ids = Object.keys(selectedBlocks).filter(k => selectedBlocks[k]);
    if (ids.length < 2) {
      alert('Select at least two blocks (Ctrl-click) to group.');
      return;
    }
    const blocksToGroup = view.blocks.filter(b => ids.includes(b.id));
    const remaining = view.blocks.filter(b => !ids.includes(b.id));

    // Map internal port key "blockId:portId" => metadata about needed proxies
    const internalMap = new Map<string, {
      blockId: string;
      portId: string;
      needsIn?: boolean;
      needsOut?: boolean;
      originalOutTargets: Port['target'][];
      externalSources: { blockId: string; portId: string }[];
    }>();

    function ensureInternalEntry(blockId: string, portId: string) {
      const key = `${blockId}:${portId}`;
      if (!internalMap.has(key)) {
        internalMap.set(key, { blockId, portId, originalOutTargets: [], externalSources: [] });
      }
      return internalMap.get(key)!;
    }

    // 1) internal -> outside
    blocksToGroup.forEach(b => {
      (b.ports ?? []).forEach(p => {
        if (p.target && !ids.includes(p.target.blockId)) {
          const en = ensureInternalEntry(b.id, p.id);
          en.needsOut = true;
          en.originalOutTargets.push(p.target);
        }
      });
    });

    // 2) outside -> internal
    view.blocks.forEach(b => {
      if (ids.includes(b.id)) return;
      (b.ports ?? []).forEach(p => {
        if (p.target && ids.includes(p.target.blockId)) {
          const key = `${p.target.blockId}:${p.target.portId}`;
          const en = ensureInternalEntry(p.target.blockId, p.target.portId);
          en.needsIn = true;
          en.externalSources.push({ blockId: b.id, portId: p.id });
        }
      });
    });

    // helper to read a port's display name from local/root (fall back to id)
    function portDisplayName(t?: { blockId: string; portId: string } | null) {
      if (!t) return '';
      const blk = findBlockRecursive(t.blockId);
      const p = blk ? (blk.ports ?? []).find(pp => pp.id === t.portId) : undefined;
      return (p && p.name) ? p.name : t.portId;
    }
    function externalSourcePortName(src?: { blockId: string; portId: string } | null) {
      if (!src) return '';
      // prefer the source port's name (outside port that fed this internal port)
      const srcBlk = findBlockRecursive(src.blockId);
      const srcPort = srcBlk ? (srcBlk.ports ?? []).find(pp => pp.id === src.portId) : undefined;
      return (srcPort && srcPort.name) ? srcPort.name : src.portId;
    }

    // Build group ports and maps to update connections
    const groupId = `g${Date.now()}`;
    const groupPorts: Port[] = [];
    const internalToGroupIn = new Map<string, string>();
    const internalToGroupOut = new Map<string, string>();

    let gpCounter = 0;
    for (const [key, info] of internalMap.entries()) {
      const internalBlock = blocksToGroup.find(bb => bb.id === info.blockId);
      const internalPort = internalBlock?.ports?.find(pp => pp.id === info.portId);
      // default display is "child.port"
      const internalDisplay = `${internalBlock?.name ?? info.blockId}.${internalPort?.name ?? info.portId}`;

      // For inputs promoted (outside -> internal) name the group input port after the external source port
      if (info.needsIn) {
        const gpId = `${groupId}-in-${gpCounter++}`;
        // try to pick the first external source port name (the outside port that pointed to this internal port)
        const ext = info.externalSources[0];
        const gpName = ext ? externalSourcePortName(ext) || internalDisplay : internalDisplay;
        // group input proxy points to internal block's port so inside subview it maps to child
        const gp: Port = { id: gpId, name: gpName, side: 'left', target: { blockId: info.blockId, portId: info.portId } };
        groupPorts.push(gp);
        internalToGroupIn.set(key, gpId);
      }

      // For outputs promoted (internal -> outside) name the group output port after the external target port
      if (info.needsOut) {
        const gpId = `${groupId}-out-${gpCounter++}`;
        const origTarget = info.originalOutTargets[0] ?? null;
        const gpName = origTarget ? portDisplayName(origTarget) || internalDisplay : internalDisplay;
        // group output proxy will be targeted by internal ports and will reflect/point to original external target(s) at group level
        const gp: Port = { id: gpId, name: gpName, side: 'right', target: origTarget ?? null };
        groupPorts.push(gp);
        internalToGroupOut.set(key, gpId);
      }
    }

    // Update outside blocks to point to group's input ports instead of internal ports
    const updatedRemaining = remaining.map(b => {
      const updatedPorts = (b.ports ?? []).map(p => {
        if (p.target && ids.includes(p.target.blockId)) {
          const key = `${p.target.blockId}:${p.target.portId}`;
          const gpId = internalToGroupIn.get(key);
          if (gpId) return { ...p, target: { blockId: groupId, portId: gpId } };
        }
        return p;
      });
      return { ...b, ports: updatedPorts };
    });

    // compute group origin and make subblocks coordinates relative to group's origin
    const groupX = Math.min(...blocksToGroup.map(b => b.x ?? 40));
    const groupY = Math.min(...blocksToGroup.map(b => b.y ?? 20));

    // Update internal blocks' ports: if an internal port pointed outside, redirect it to group's out port.
    // Also convert subblock coordinates to be relative to group's origin (so they render inside subview properly).
    const updatedSubblocks = blocksToGroup.map(b => {
      const updatedPorts = (b.ports ?? []).map(p => {
        const key = `${b.id}:${p.id}`;
        const gpOut = internalToGroupOut.get(key);
        if (gpOut) {
          // internal port that originally pointed outside now points to the group's out proxy
          return { ...p, target: { blockId: groupId, portId: gpOut } };
        }
        return p;
      });
      return { ...b, ports: updatedPorts, x: (b.x ?? 0) - groupX, y: (b.y ?? 0) - groupY };
    });

    const groupBlock: Block = {
      id: groupId,
      name: 'Group',
      x: groupX,
      y: groupY,
      ports: groupPorts,
      requirements: [],
      subblocks: updatedSubblocks,
    };

    const newBlocks = [...updatedRemaining, groupBlock];

    // Persist changes into view / root
    replaceTopViewBlocks(newBlocks);
    if (view.parentBlockId === null) updateTopLevelBlocks(newBlocks);
    else {
      const root = local.blocks.map(b => (b.id === view.parentBlockId ? { ...b, subblocks: newBlocks } : b));
      updateTopLevelBlocks(root);
    }

    setSelectedBlocks({});
    setSelectedBlockId(groupId);
  }

  // enter a subblock (if the selected block has subblocks)
  function enterSubblock(block: Block) {
    if (!Array.isArray(block.subblocks)) {
      alert('Block has no subblocks to enter.');
      return;
    }
    // when entering, subblocks are already stored with coordinates relative to group origin
    setViewStack(prev => [...prev, { blocks: block.subblocks || [], parentBlockId: block.id }]);
    setSelectedBlockId(null);
    setSelectedBlocks({});
  }

  function exitSubblock() {
    if (viewStack.length <= 1) return;
    // write back the top view blocks into parent block's subblocks, converting coordinates back to global
    const top = viewStack[viewStack.length - 1]; // the view we are leaving
    const parentLevel = viewStack[viewStack.length - 2];
    const parentBlockId = top.parentBlockId;
    if (!parentBlockId) {
      setViewStack(prev => prev.slice(0, -1));
      return;
    }
    const parentBlock = findBlockRecursive(parentBlockId);
    if (!parentBlock) {
      // fallback: just pop
      setViewStack(prev => prev.slice(0, -1));
      return;
    }

    // convert relative coords back to parent's global position
    const restoredSubblocks = (top.blocks || []).map(sb => ({
      ...sb,
      x: (sb.x ?? 0) + (parentBlock.x ?? 0),
      y: (sb.y ?? 0) + (parentBlock.y ?? 0),
    }));

    // update the parent block in the root blocks list
    const updatedRootBlocks = local.blocks.map(b => (b.id === parentBlockId ? { ...b, subblocks: restoredSubblocks } : b));
    updateTopLevelBlocks(updatedRootBlocks);

    // pop view
    setViewStack(prev => prev.slice(0, -1));
  }

  // build connections using findPortPos for both ends (ensures parent-edge ports and child ports align)
  const conns: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  view.blocks.forEach(b => {
    const ports = normalizePorts(b);
    ports.forEach((p: Port) => {
      if (p.target && p.target.blockId && p.target.portId) {
        // When at top-level, skip drawing any connection where either endpoint is not a top-level block
        if (view.parentBlockId === null) {
          const sourceIsTopLevel = (local.blocks || []).some(tb => tb.id === b.id);
          const targetIsTopLevel = (local.blocks || []).some(tb => tb.id === p.target!.blockId);
          if (!sourceIsTopLevel || !targetIsTopLevel) return;
        }

        const a = findPortPos(b.id, p.id);
        const bpos = findPortPos(p.target.blockId, p.target.portId);
        if (a && bpos) conns.push({ from: a, to: bpos });
      }
    });
  });

  // include connections from outside blocks targeting current view blocks (use findPortPos)
  (local.blocks || []).forEach(bOutside => {
    // skip blocks that are part of current view (we already handled their outgoing conns above)
    if ((view.blocks || []).some(vb => vb.id === bOutside.id)) return;
    (bOutside.ports ?? []).forEach(p => {
      if (p.target && view.blocks.some(vb => vb.id === p.target!.blockId)) {
        // skip if this is an internal connection of a group when viewing root
        if (view.parentBlockId === null) {
          const sourceIsTopLevel = (local.blocks || []).some(tb => tb.id === bOutside.id);
          if (!sourceIsTopLevel) return;
        }
        const from = findPortPos(bOutside.id, p.id);
        const to = findPortPos(p.target!.blockId, p.target!.portId);
        if (from && to) conns.push({ from, to });
      }
    });
  });

  return (
    <div style={{ paddingTop: 12, display: 'flex', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8 }}>
          <button onClick={addBlockHere}>Add Block</button>
          <button onClick={groupSelectedIntoSubblock} style={{ marginLeft: 8 }}>
            Group Selected
          </button>
          {viewStack.length > 1 ? (
            <button onClick={exitSubblock} style={{ marginLeft: 8 }}>
              ← Back
            </button>
          ) : null}
          {pendingConn ? <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>Connecting from {pendingConn.blockId}:{pendingConn.portId} — click target port</span> : null}
        </div>

        <svg
          ref={svgRef}
          width="100%"
          height={Math.max(420, view.blocks.length * 120)}
          style={{ background: '#fafafa', border: '1px solid #eee', cursor: draggingBlockId ? 'grabbing' : 'default' }}
        >
          {/* if in subview, draw the group bounding box so parent-edge ports are visually anchored */}
          {view.parentBlockId ? (() => {
            const { box } = getViewBox();
            return (
              <g>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} fill="#fff" stroke="#dfe6f6" />
              </g>
            );
          })() : null}

          {/* connections */}
          {conns.map((c, i) => (
            <g key={i}>
              <path d={`M ${c.from.x} ${c.from.y} C ${c.from.x + 40} ${c.from.y} ${c.to.x - 40} ${c.to.y} ${c.to.x} ${c.to.y}`} stroke="#888" fill="none" strokeWidth={2} />
              <circle cx={c.to.x} cy={c.to.y} r={3} fill="#555" />
            </g>
          ))}

          {/* If we're inside a subblock view, render the parent block's ports at the group's inner edges (anchored, colored) */}
          {view.parentBlockId ? (() => {
            const parent = findBlockRecursive(view.parentBlockId!);
            if (!parent || !parent.ports) return null;
            const ports = normalizePorts(parent);
            const leftPorts = ports.filter(p => p.side === 'left');
            const rightPorts = ports.filter(p => p.side === 'right');
            return (
              <g>
                {leftPorts.map(p => {
                  const pos = findPortPos(parent.id, p.id);
                  if (!pos) return null;
                  return (
                    <g key={`parent-edge-${p.id}`}>
                      <circle cx={pos.x} cy={pos.y} r={6} fill="#4aa3ff" stroke="#333"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingConn) { clickPortToConnect(parent.id, p.id); return; }
                          setSelectedBlockId(parent.id); setEditingPortId(p.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <text x={pos.x + 12} y={pos.y + 4} fontSize={11} fill="#111">{p.name ?? p.id}</text>
                    </g>
                  );
                })}
                {rightPorts.map(p => {
                  const pos = findPortPos(parent.id, p.id);
                  if (!pos) return null;
                  return (
                    <g key={`parent-edge-${p.id}`}>
                      <circle cx={pos.x} cy={pos.y} r={6} fill="#ff8a4a" stroke="#333"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingConn) { clickPortToConnect(parent.id, p.id); return; }
                          setSelectedBlockId(parent.id); setEditingPortId(p.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <text x={pos.x - 8} y={pos.y + 4} fontSize={11} fill="#111">{p.name ?? p.id}</text>
                    </g>
                  );
                })}
              </g>
            );
          })() : null}

          {/* blocks in current view (apply innerOffset when inside subview so children render inside the group box) */}
          {view.blocks.map((b, bi) => {
            const idx = bi;
            const baseX = b.x ?? (40 + idx * 30);
            const baseY = b.y ?? (20 + idx * 90);
            const viewOffset = view.parentBlockId ? getViewBox().innerOffset : { x: 0, y: 0 };
            const bx = baseX + viewOffset.x;
            const by = baseY + viewOffset.y;
            const size = blockSize(b);
            const ports = normalizePorts(b);
            return (
              <g key={b.id}>
                <rect
                  x={bx}
                  y={by}
                  width={size.width}
                  height={size.height}
                  rx={6}
                  fill={selectedBlocks[b.id] ? '#e9f2ff' : '#fff'}
                  stroke="#333"
                  strokeWidth={1}
                  onClick={(e) => onBlockClick(e, b)}
                  onMouseDown={(e) => onBlockMouseDown(e, b)}
                  style={{ cursor: 'grab' }}
                />
                <text x={bx + 8} y={by + 22} fontSize={14} fontWeight="600" fill="#111" pointerEvents="none">
                  {b.name}
                </text>

                {/* small enter indicator if has subblocks */}
                {Array.isArray(b.subblocks) && b.subblocks.length ? (
                  <g onClick={() => enterSubblock(b)} style={{ cursor: 'pointer' }}>
                    <rect x={bx + size.width - 56} y={by + 6} width={48} height={18} rx={4} fill="#f0f0ff" stroke="#cbd4ff" />
                    <text x={bx + size.width - 44} y={by + 18} fontSize={11} fill="#333">Enter</text>
                  </g>
                ) : null}

                {/* ports (render using portPos + viewOffset so they align with connections) */}
                {ports.map((p: Port) => {
                  const raw = portPos(b, p);
                  const pos = view.parentBlockId ? { x: raw.x + getViewBox().innerOffset.x, y: raw.y + getViewBox().innerOffset.y } : raw;
                  const isPendingTarget = pendingConn && !(pendingConn.blockId === b.id && pendingConn.portId === p.id);
                  return (
                    <g key={p.id}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={6}
                        fill={p.side === 'left' ? '#4aa3ff' : '#ff8a4a'}
                        stroke="#333"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pendingConn) { clickPortToConnect(b.id, p.id); return; }
                          setSelectedBlockId(b.id); setEditingPortId(p.id);
                        }}
                        style={{ cursor: 'pointer', opacity: isPendingTarget ? 0.9 : 1 }}
                      />
                      <text x={pos.x + (p.side === 'left' ? -40 : 10)} y={pos.y + 4} fontSize={11} fill="#111">
                        {p.name ?? p.id}
                      </text>
                    </g>
                  );
                })}

                {/* render subblocks inside block visually (summary) */}
                {Array.isArray(b.subblocks) && b.subblocks.length > 0 && (
                  b.subblocks.slice(0, 3).map((sb, si) => {
                    const sx = bx + 8;
                    const sy = by + 30 + si * 12;
                    return (
                      <g key={sb.id}>
                        <rect x={sx} y={sy} width={80} height={10} rx={3} fill="#f6f7fb" stroke="#c5cbe3" />
                        <text x={sx + 4} y={sy + 8} fontSize={9} fill="#333">{sb.name}</text>
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}
        </svg>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Drag blocks to move. Ctrl-click to multi-select.</div>
      </div>

      {/* inspector / editor */}
      <div style={{ width: 400, borderLeft: '1px solid #eee', paddingLeft: 12, overflowY: 'auto', maxHeight: '80vh' }}>
        <h4>Inspector</h4>
        <div style={{ fontSize: 13, color: '#444' }}>View level: {viewStack.length - 1}</div>

        {selectedBlockId ? (
          (() => {
            const b = view.blocks.find(bb => bb.id === selectedBlockId) || findBlockRecursive(selectedBlockId);
            if (!b) return <div>Select a block</div>;
            return (
              <div>
                <div style={{ marginTop: 8 }}>
                  <div><strong>Block</strong></div>
                  <div style={{ marginTop: 6 }}>
                    <label>Name: </label>
                    <input value={b.name} onChange={e => updateBlockInView({ ...b, name: e.target.value })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label>X: </label>
                    <input type="number" value={b.x ?? 0} onChange={e => updateBlockInView({ ...b, x: parseInt(e.target.value) || 0 })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label>Y: </label>
                    <input type="number" value={b.y ?? 0} onChange={e => updateBlockInView({ ...b, y: parseInt(e.target.value) || 0 })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => addPort(b.id, 'left')}>+ Port (left)</button>
                    <button onClick={() => addPort(b.id, 'right')} style={{ marginLeft: 8 }}>+ Port (right)</button>
                    <button onClick={() => enterSubblock(b)} style={{ marginLeft: 8 }} disabled={!b.subblocks || b.subblocks.length === 0}>
                      Enter Subblock
                    </button>
                    <button onClick={() => {
                      const remaining = view.blocks.filter(x => x.id !== b.id);
                      replaceTopViewBlocks(remaining);
                      if (view.parentBlockId === null) updateTopLevelBlocks(remaining);
                      else {
                        const root = local.blocks.map(rb => (rb.id === view.parentBlockId ? { ...rb, subblocks: remaining } : rb));
                        updateTopLevelBlocks(root);
                      }
                      setSelectedBlockId(null);
                    }} style={{ marginLeft: 8, color: 'darkred' }}>Delete</button>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div><strong>Block Requirements</strong></div>
                  {(b.requirements ?? []).filter(r => !r.portId).map(r => (
                    <div key={r.id} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input 
                        value={r.text} 
                        onChange={e => editRequirement(b.id, r.id, e.target.value)}
                        style={{ flex: 1 }}
                        placeholder="Requirement..."
                      />
                      <button onClick={() => removeRequirement(b.id, r.id)} style={{ color: 'darkred' }}>Remove</button>
                    </div>
                  ))}
                  <button onClick={() => addRequirement(b.id)} style={{ marginTop: 6 }}>+ Add Requirement</button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div><strong>Ports ({(b.ports ?? []).length})</strong></div>
                  {(b.ports ?? []).map(p => (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                      <div>
                        <label>Name: </label>
                        <input value={p.name ?? ''} onChange={e => editPort(b.id, p.id, { name: e.target.value })} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label>Side: </label>
                        <select value={p.side ?? 'right'} onChange={e => editPort(b.id, p.id, { side: e.target.value as any })} style={{ width: '100%' }}>
                          <option value="left">left</option>
                          <option value="right">right</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startConnect(b.id, p.id)} style={{ flex: 1 }}>Connect</button>
                        <button onClick={() => removePort(b.id, p.id)} style={{ color: 'darkred' }}>Remove</button>
                      </div>
                      {p.target && <div style={{ fontSize: 11, color: '#666' }}>→ {p.target.blockId}:{p.target.portId}</div>}

                      {/* Port requirements */}
                      <div style={{ marginTop: 6, borderTop: '1px solid #ddd', paddingTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Port Requirements</div>
                        {(b.requirements ?? []).filter(r => r.portId === p.id).map(r => (
                          <div key={r.id} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <input 
                              value={r.text} 
                              onChange={e => editRequirement(b.id, r.id, e.target.value)}
                              style={{ flex: 1, fontSize: 11 }}
                              placeholder="Port requirement..."
                            />
                            <button onClick={() => removeRequirement(b.id, r.id)} style={{ color: 'darkred', fontSize: 11 }}>Remove</button>
                          </div>
                        ))}
                        <button onClick={() => addRequirement(b.id, p.id)} style={{ marginTop: 4, fontSize: 11 }}>+ Req</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        ) : (
          <div style={{ color: '#666', marginTop: 12 }}>Click a block (or Ctrl-click to multi-select). Selected blocks can be grouped.</div>
        )}
      </div>
    </div>
  );
}

function DiagramView() {
  const { id } = useParams<{ id: string }>();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Diagram>(`/api/diagrams/${id}`)
      .then(setDiagram)
      .catch(err => console.error(err));
  }, [id]);

  if (!diagram) return <div style={{ padding: 20 }}>Loading...</div>;

  async function saveDiagram(current: Diagram) {
    setLoading(true);
    try {
      const updated = await api<Diagram>(`/api/diagrams/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify(current),
      });
      setDiagram(updated);
      alert('Diagram saved');
    } catch (err) {
      console.error('Failed to save diagram', err);
      alert('Failed to save diagram — see console');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <p>
        <Link to="/">← Back</Link>
      </p>
      <h2>{diagram.name}</h2>
      <button onClick={() => saveDiagram(diagram)} disabled={loading}>
        {loading ? 'Saving...' : 'Save Diagram'}
      </button>

      <DiagramCanvas diagram={diagram} onUpdate={setDiagram} />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/diagram/:id">
          <DiagramView />
        </Route>
        <Route path="/">
          <DiagramList />
        </Route>
      </Switch>
    </Router>
  );
}