/**
 * /api/workspaces/[workspaceId]/knowledge — list KB entries for a workspace.
 *
 * Returns a flat list of entries from the workspace's hybrid KB index
 * (workspace notes carrying wikiFrontmatter ∪ repo-level fs wiki entries).
 *
 * GET /api/workspaces/:id/knowledge → { entries: KbEntryMeta[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { buildHybridKbIndex } from "@/core/knowledge";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const system = getRoutaSystem();

  // Verify the workspace exists so we don't silently return repo-shared entries
  // for a typo'd URL.
  const workspace = await system.workspaceStore.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const index = await buildHybridKbIndex({
      workspaceId,
      noteStore: system.noteStore,
      repoRoot: process.cwd(),
    });
    return NextResponse.json({
      workspaceId,
      generatedAt: index.generatedAt,
      entries: index.entries,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to build knowledge index: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
