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
          },
          position: { x: 0, y: 0 }, // sera recalculé par dagre
          style: {
            padding: 10,
            border: '1px solid #b0bec5',
            borderRadius: 8,
            background: getNodeColor(step.title),
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
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

  if (loading) return <div>Loading workflow...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={onConnect}
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
    </div>
  );
}
