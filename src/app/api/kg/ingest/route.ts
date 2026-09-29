/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const CHROMA = process.env.CHROMA_SERVICE_URL ?? "http://localhost:8000";
const CONFIDENCE_GATE = 0.62; // below this, entity/relation not stored
const VERIFY_THRESHOLD = 0.75; // relations above this are auto-verified

function chunkText(text: string, chunkSize = 512, overlap = 50): string[] {
  const words  = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const slice = words.slice(start, start + chunkSize).join(" ");
    chunks.push(slice);
    start += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const text = form.get("text") as string | null;
  const name = (form.get("name") as string | null) ?? "Untitled";
  const workspaceId = form.get("workspaceId") as string;

  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // extract raw text
  let rawText = "";
  let mimeType = "text/plain";

  if (file) {
    mimeType  = file.type;
    const buf = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      // send PDF to Python service for extraction
      const fd = new FormData();
      fd.append("file", new Blob([buf], { type: "application/pdf" }), file.name);
      const pdfRes = await fetch(`${CHROMA}/kg/extract-pdf`, { method: "POST", body: fd });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        rawText = pdfData.text ?? "";
      }
    } else {
      rawText = buf.toString("utf-8");
    }
  } else if (text) {
    rawText = text;
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: "No text content extracted" }, { status: 400 });
  }

  // create source record
  const source = await db.kGSource.create({
    data: {
      workspaceId,
      name,
      sourceType:        file ? "DOCUMENT" : "MANUAL",
      mimeType,
      processingStatus:  "PROCESSING",
    },
  });

  // chunk the text
  const rawChunks = chunkText(rawText, 512, 50);

  // save chunks to DB
  const dbChunks = await Promise.all(
    rawChunks.map((content, i) =>
      db.kGChunk.create({
        data: {
          sourceId:    source.id,
          content,
          chunkIndex:  i,
        },
      })
    )
  );

  // send to Python extraction pipeline
  const extractRes = await fetch(`${CHROMA}/kg/extract`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      workspace_id: workspaceId,
      source_id:    source.id,
      chunks:       dbChunks.map(c => ({
        id:         c.id,
        content:    c.content,
        chunkIndex: c.chunkIndex,
      })),
    }),
  });

  if (!extractRes.ok) {
    await db.kGSource.update({
      where: { id: source.id },
      data:  { processingStatus: "FAILED", errorMessage: "Extraction service error" },
    });
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }

  const extractData = await extractRes.json();
  const rawEntities: any[]  = extractData.raw_entities  ?? [];
  const rawRelations: any[] = extractData.raw_relations ?? [];

  // entity resolution — deduplicate (fall back to raw entities if the service fails)
  let resolvedEntities: any[] = rawEntities;
  try {
    const resolveRes = await fetch(`${CHROMA}/kg/resolve`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ entities: rawEntities, threshold: 0.88 }),
    });
    if (resolveRes.ok) {
      const resolveData = await resolveRes.json();
      resolvedEntities  = resolveData.resolved_entities ?? rawEntities;
    }
  } catch {
    // keep rawEntities
  }

  // filter by confidence gate
  const validEntities = resolvedEntities.filter(e => e.confidence >= CONFIDENCE_GATE);

  // upsert nodes — check if they already exist (cross-document dedup)
  const nodeIdMap: Record<string, string> = {}; // label.lower → nodeId

  // get existing nodes for this workspace
  const existingNodes = await db.kGNode.findMany({
    where:  { workspaceId, status: { not: "DELETED" } },
    select: { id: true, label: true, aliases: true, confidence: true },
  });

  for (const en of existingNodes) {
    nodeIdMap[en.label.toLowerCase()] = en.id;
    const aliases = (en.aliases as string[]) ?? [];
    for (const a of aliases) nodeIdMap[a.toLowerCase()] = en.id;
  }

  const newNodes: string[] = [];

  for (const ent of validEntities) {
    const key = ent.label.toLowerCase();

    let nodeId: string | null | undefined = nodeIdMap[key];

    if (!nodeId) {
      // check aliases
      const aliasMatch = (ent.aliases ?? []).find((a: string) => nodeIdMap[a.toLowerCase()]);
      nodeId = aliasMatch ? nodeIdMap[aliasMatch.toLowerCase()] : null;
    }

    if (nodeId) {
      // merge into existing node — update aliases + confidence
      const existing = await db.kGNode.findUnique({ where: { id: nodeId } });
      const existingAliases = (existing?.aliases as string[]) ?? [];
      const mergedAliases   = [...new Set([...existingAliases, ...(ent.aliases ?? []), ent.label])];
      const newConf         = Math.max(existing?.confidence ?? 0, ent.confidence);

      await db.kGNode.update({
        where: { id: nodeId },
        data:  { aliases: mergedAliases, confidence: newConf },
      });
    } else {
      // create new node
      const node = await db.kGNode.create({
        data: {
          workspaceId,
          label:           ent.label,
          aliases:         ent.aliases ?? [],
          nodeType:        ent.nodeType as any,
          confidence:      ent.confidence,
          extractedBy:     "system",
          extractionMethod:ent.extractionMethod ?? "ner",
          primarySourceId: source.id,
        },
      });
      nodeId = node.id;
      newNodes.push(node.id);

      // index in ChromaDB for semantic search
      await fetch(`${CHROMA}/kg/index-node`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          workspace_id: workspaceId,
          node_id:      nodeId,
          label:        ent.label,
          description:  ent.label,
          node_type:    ent.nodeType,
          confidence:   ent.confidence,
        }),
      }).catch(() => {});
    }

    // nodeId is definitely a string here (both branches assign/verify it)
    const finalNodeId: string = nodeId;

    nodeIdMap[ent.label.toLowerCase()] = finalNodeId;
    for (const alias of (ent.aliases ?? [])) {
      nodeIdMap[alias.toLowerCase()] = finalNodeId;
    }

    // create node-chunk grounding
    if (ent.chunkId) {
      await db.kGNodeChunk.upsert({
        where: { nodeId_chunkId: { nodeId: finalNodeId, chunkId: ent.chunkId } },
        update:{},
        create: {
          nodeId:      finalNodeId,
          chunkId:     ent.chunkId,
          spanStart:   ent.spanStart,
          spanEnd:     ent.spanEnd,
          confidence:  ent.confidence,
          mentionText: ent.mentionText,
        },
      }).catch(() => {});
    }
  }

  // process relations
  let edgesCreated = 0;

  for (const rel of rawRelations) {
    if (rel.confidence < CONFIDENCE_GATE) continue;

    const srcId = nodeIdMap[rel.sourceLabel?.toLowerCase()];
    const tgtId = nodeIdMap[rel.targetLabel?.toLowerCase()];
    if (!srcId || !tgtId || srcId === tgtId) continue;

    // verify high-confidence relations, auto-accept others
    let finalConf  = rel.confidence;
    let verifiedBy: string | null = null;

    if (rel.confidence >= VERIFY_THRESHOLD) {
      verifiedBy = "auto";
    } else if (rel.evidenceText) {
      // verify with Groq
      const verifyRes = await fetch(`${CHROMA}/kg/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          source_label: rel.sourceLabel,
          target_label: rel.targetLabel,
          edge_type:    rel.edgeType,
          evidence:     rel.evidenceText,
        }),
      });
      if (verifyRes.ok) {
        const vd = await verifyRes.json();
        if (!vd.valid) continue; // reject
        finalConf  = vd.confidence;
        verifiedBy = "groq";
      }
    }

    if (finalConf < CONFIDENCE_GATE) continue;

    const edge = await db.kGEdge.upsert({
      where: {
        sourceId_targetId_edgeType: {
          sourceId: srcId,
          targetId: tgtId,
          edgeType: rel.edgeType as any,
        },
      },
      update: {
        confidence:  Math.max(finalConf, 0),
        verifiedBy:  verifiedBy ?? undefined,
      },
      create: {
        workspaceId,
        sourceId:        srcId,
        targetId:        tgtId,
        edgeType:        rel.edgeType as any,
        confidence:      finalConf,
        extractedBy:     "system",
        extractionMethod:rel.extractionMethod ?? "pattern",
        verifiedBy:      verifiedBy,
        primarySourceId: source.id,
      },
    });

    if (rel.chunkId) {
      await db.kGEdgeChunk.upsert({
        where: { edgeId_chunkId: { edgeId: edge.id, chunkId: rel.chunkId } },
        update: {},
        create: {
          edgeId:       edge.id,
          chunkId:      rel.chunkId,
          confidence:   finalConf,
          evidenceText: rel.evidenceText,
        },
      }).catch(() => {});
    }

    edgesCreated++;
  }

  // update source stats + graph stats
  await db.kGSource.update({
    where: { id: source.id },
    data: {
      processingStatus: "DONE",
      chunkCount:       dbChunks.length,
      extractedAt:      new Date(),
    },
  });

  await db.kGGraph.upsert({
    where:  { workspaceId },
    update: {
      nodeCount:   { increment: newNodes.length },
      edgeCount:   { increment: edgesCreated },
      sourceCount: { increment: 1 },
      lastBuiltAt: new Date(),
    },
    create: {
      workspaceId,
      nodeCount:   newNodes.length,
      edgeCount:   edgesCreated,
      sourceCount: 1,
      lastBuiltAt: new Date(),
    },
  });

  return NextResponse.json({
    sourceId:      source.id,
    chunksCreated: dbChunks.length,
    nodesCreated:  newNodes.length,
    edgesCreated,
    totalEntities: validEntities.length,
    totalRelations:rawRelations.length,
  });
}