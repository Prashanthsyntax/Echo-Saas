"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from "./knowledge-types";
import { NODE_COLORS, NODE_TYPE_LABELS } from "./knowledge-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";

interface KnowledgeGraphProps {
  graph: KnowledgeGraph;
  onReset: () => void;
}

interface SimNode extends KnowledgeNode {
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  label: string;
}

export function KnowledgeGraphView({ graph, onReset }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [nodeCount] = useState(graph.nodes.length);
  const [edgeCount] = useState(graph.edges.length);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // arrow marker for directed edges
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(240 6% 18%)");

    // zoom group
    const g = svg.append("g");

    // set up zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // deep clone nodes and edges for simulation
    const simNodes: SimNode[] = graph.nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      fx: null,
      fy: null,
    }));

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: SimEdge[] = graph.edges
      .map((e) => {
        const sourceId =
          typeof e.source === "string" ? e.source : (e.source as KnowledgeNode).id;
        const targetId =
          typeof e.target === "string" ? e.target : (e.target as KnowledgeNode).id;
        const source = nodeMap.get(sourceId);
        const target = nodeMap.get(targetId);
        if (!source || !target) return null;
        return { source, target, label: e.label };
      })
      .filter(Boolean) as SimEdge[];

    // force simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(120)
          .strength(0.8)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    // draw edges
    const edgeGroup = g.append("g").attr("class", "edges");

    const edgeLine = edgeGroup
      .selectAll("line")
      .data(simEdges)
      .enter()
      .append("line")
      .attr("stroke", "hsl(240 6% 18%)")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)");

    // edge labels
    const edgeLabel = edgeGroup
      .selectAll("text")
      .data(simEdges)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "hsl(240 5% 45%)")
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .text((d) => d.label);

    // draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (_event, d) => {
        setSelectedNode((prev) => (prev?.id === d.id ? null : d));
      });

    // node circle
    node
      .append("circle")
      .attr("r", 28)
      .attr("fill", (d) => NODE_COLORS[d.type] + "22")
      .attr("stroke", (d) => NODE_COLORS[d.type])
      .attr("stroke-width", 2);

    // node icon text (emoji-style letter)
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .attr("fill", (d) => NODE_COLORS[d.type])
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .text((d) => d.label.slice(0, 2).toUpperCase());

    // node label below
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", 40)
      .attr("font-size", "11px")
      .attr("fill", "hsl(240 5% 75%)")
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .text((d) =>
        d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label
      );

    // highlight on hover
    node
      .on("mouseenter", function (_event, d) {
        d3.select(this)
          .select("circle")
          .attr("stroke-width", 3)
          .attr("r", 32);
      })
      .on("mouseleave", function (_event, d) {
        d3.select(this)
          .select("circle")
          .attr("stroke-width", 2)
          .attr("r", 28);
      });

    // tick update
    simulation.on("tick", () => {
      edgeLine
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      edgeLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2 - 6);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // auto-fit after simulation settles
    simulation.on("end", () => {
      const bounds = g.node()?.getBBox();
      if (!bounds) return;
      const padding = 60;
      const scaleX = (width - padding * 2) / bounds.width;
      const scaleY = (height - padding * 2) / bounds.height;
      const scale = Math.min(scaleX, scaleY, 1);
      const tx = width / 2 - scale * (bounds.x + bounds.width / 2);
      const ty = height / 2 - scale * (bounds.y + bounds.height / 2);
      svg
        .transition()
        .duration(600)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
    });

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      svg.attr("width", w).attr("height", h);
      simulation.force("center", d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.1).restart();
    });
    ro.observe(container);

    return () => {
      simulation.stop();
      ro.disconnect();
    };
  }, [graph]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .call(zoomRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .call(zoomRef.current.scaleBy, 0.7);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .call(zoomRef.current.transform, d3.zoomIdentity);
  };

  // group nodes by type for legend
  const typeGroups = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{graph.title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {graph.summary}
          </p>
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {nodeCount} nodes
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {edgeCount} edges
            </Badge>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={handleZoomIn}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            Upload new PDF
          </Button>
        </div>
      </div>

      {/* graph area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1">
          <svg
            ref={svgRef}
            className="h-full w-full"
            style={{ background: "hsl(240 6% 4%)" }}
          />
        </div>

        {/* legend */}
        <div className="absolute left-4 top-4 rounded-xl border border-border bg-card/90 p-3 backdrop-blur-sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Node types
          </p>
          <div className="space-y-1.5">
            {Object.entries(typeGroups).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      NODE_COLORS[type as KnowledgeNode["type"]],
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {NODE_TYPE_LABELS[type as KnowledgeNode["type"]]}
                </span>
                <span className="text-xs text-muted-foreground/50">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* node detail panel */}
        {selectedNode && (
          <div className="absolute right-4 top-4 w-64 rounded-xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: NODE_COLORS[selectedNode.type],
                  }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: NODE_COLORS[selectedNode.type] }}
                >
                  {NODE_TYPE_LABELS[selectedNode.type]}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm font-semibold">{selectedNode.label}</p>
            {selectedNode.description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {selectedNode.description}
              </p>
            )}
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Connected to{" "}
                <span className="font-medium text-foreground">
                  {
                    graph.edges.filter((e) => {
                      const sid =
                        typeof e.source === "string"
                          ? e.source
                          : (e.source as KnowledgeNode).id;
                      const tid =
                        typeof e.target === "string"
                          ? e.target
                          : (e.target as KnowledgeNode).id;
                      return (
                        sid === selectedNode.id || tid === selectedNode.id
                      );
                    }).length
                  }
                </span>{" "}
                other nodes
              </p>
            </div>
          </div>
        )}

        {/* hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <p className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            Click a node to inspect · Drag to rearrange · Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}