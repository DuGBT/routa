import { KnowledgePageClient } from "./knowledge-page-client";

export async function generateStaticParams() {
  if (process.env.ROUTA_BUILD_STATIC === "1") {
    return [{ workspaceId: "__placeholder__" }];
  }
  return [];
}

export default function WorkspaceKnowledgePage() {
  return <KnowledgePageClient />;
}
