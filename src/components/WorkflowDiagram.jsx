import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';

export default function WorkflowDiagram() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch('http://localhost:8000/file/return-json/', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: '', // empty POST body like curl
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();

        // Transform JSON tree into React Flow nodes
        const mappedNodes = data.tree.map((step, index) => ({
          id: step.id,
          data: { label: `${step.title}\n(${step.id})` },
          position: { x: 100 + (index % 5) * 250, y: Math.floor(index / 5) * 100 },
          style: {
            padding: 10,
            border: '1px solid #222',
            borderRadius: 5,
            background: '#f0f0f0',
          },
        }));

        // Transform dependencies into edges
        const mappedEdges = [];
        data.tree.forEach((step) => {
          step.dependencies.forEach((depId) => {
            mappedEdges.push({ id: `e-${depId}-${step.id}`, source: depId, target: step.id });
          });
        });

        setNodes(mappedNodes);
        setEdges(mappedEdges);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch JSON:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  if (loading) return <div>Loading workflow...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
        <MiniMap />
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
}
