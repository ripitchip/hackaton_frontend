// src/components/WorkflowDiagram.jsx

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

const nodeWidth = 220;
const nodeHeight = 70;

// Layout avec dagre (gauche → droite par défaut)
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === 'LR';

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Couleur simple en fonction du titre (à adapter si besoin)
const getNodeColor = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('wing')) return '#e3f2fd';       // bleu clair
  if (t.includes('fuselage')) return '#e8f5e9';   // vert clair
  if (t.includes('tail')) return '#fff3e0';       // orange clair
  if (t.includes('gear')) return '#f3e5f5';       // violet clair
  return '#f5f5f5';                               // gris clair par défaut
};

export default function WorkflowDiagram() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s

        const response = await fetch('http://localhost:8000/file/return-json/', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: '', // POST vide comme ton curl
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // 1) Création des nœuds bruts
        const rawNodes = data.tree.map((step) => ({
          id: step.id,
          data: {
            label: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>{step.title}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>({step.id})</div>
              </div>
            ),
            // attach the original step metadata so click handlers can show it
            meta: step,
          },
          position: { x: 0, y: 0 }, // sera recalculé par dagre
          style: {
            padding: 10,
            border: '1px solid #b0bec5',
            borderRadius: 8,
            background: getNodeColor(step.title),
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            cursor: 'pointer',
          },
        }));

        // 2) Création des arêtes
        const rawEdges = [];
        data.tree.forEach((step) => {
          step.dependencies.forEach((depId) => {
            rawEdges.push({
              id: `e-${depId}-${step.id}`,
              source: depId,
              target: step.id,
              type: 'smoothstep',
              animated: true,
            });
          });
        });

        // 3) Application du layout dagre (gauche → droite)
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(rawNodes, rawEdges, 'LR');

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch JSON:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
          },
          eds,
        ),
      ),
    [],
  );

  const onNodeClick = useCallback((event, node) => {
    // node.data.meta was attached during construction
    setSelectedNode(node?.data?.meta || { id: node?.id, label: node?.data?.label });
  }, []);

  const clearSelection = useCallback(() => setSelectedNode(null), []);

  if (loading) return <div>Loading workflow...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={clearSelection}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <MiniMap
          nodeStrokeColor={() => '#90a4ae'}
          nodeColor={(n) => n.style?.background || '#ffffff'}
        />
        <Controls />
        <Background gap={24} />
      </ReactFlow>

      {/* styled right-side panel for the selected node */}
      {selectedNode && (
        <aside
          role="dialog"
          aria-labelledby="wf-node-title"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100%',
            width: 380,
            maxWidth: '40%',
            background: '#ffffff',
            borderLeft: '1px solid rgba(0,0,0,0.06)',
            padding: 18,
            zIndex: 9999,
            boxShadow: '-10px 0 30px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 220ms ease',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div id="wf-node-title" style={{ fontSize: 16, fontWeight: 700 }}>{selectedNode.title || selectedNode.name || `Node ${selectedNode.id}`}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ID: {selectedNode.id}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(selectedNode, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  } catch (e) {
                    // ignore clipboard failures
                  }
                }}
                title="Copy JSON"
                style={{ background: '#eef2ff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={clearSelection} aria-label="Close panel" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                ✕
              </button>
            </div>
          </header>

          <main style={{ marginTop: 12, overflowY: 'auto', flex: 1 }}>
            {/* nice fields presentation */}
            {selectedNode.dependencies && (
              <section style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Dependencies</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedNode.dependencies.length ? (
                    selectedNode.dependencies.map((d) => (
                      <span key={d} style={{ background: '#f1f5f9', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}>{d}</span>
                    ))
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>None</div>
                  )}
                </div>
              </section>
            )}

            {/* render other metadata keys (except common ones) */}
            <section>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Properties</div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.keys(selectedNode || {}).filter(k => !['id','title','name','dependencies'].includes(k)).map((k) => (
                      <tr key={k}>
                        <td style={{ padding: '6px 8px', verticalAlign: 'top', width: '38%', color: '#6b7280', fontSize: 13 }}>{k}</td>
                        <td style={{ padding: '6px 8px', verticalAlign: 'top', fontSize: 13 }}>
                          {typeof selectedNode[k] === 'object' ? (
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selectedNode[k], null, 2)}</pre>
                          ) : (
                            String(selectedNode[k])
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>

          <footer style={{ marginTop: 12, textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
            Click background to close
          </footer>
        </aside>
      )}
    </div>
  );
}
