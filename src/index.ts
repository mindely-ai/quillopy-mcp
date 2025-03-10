import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const QUILLOPY_API_BASE = "https://quillopy.fly.dev/v1";

const server = new McpServer({
  name: "quillopy",
  version: "1.0.0",
});

interface Document {
  link: string;
  content: string;
  semantic_identifier: string;
}

interface ApiResponse {
  instructions: string[];
  documents: Document[];
}

interface RequestBody {
  query: string;
  package_name: string;
  language: string;
  namespace?: string;
}

async function makeQuillopyRequest({
  query,
  package_name,
  language,
  namespace,
}: {
  query: string;
  package_name: string;
  language: string;
  namespace?: string;
}): Promise<ApiResponse | null> {
  try {
    const url = `${QUILLOPY_API_BASE}/document-search`;

    const requestBody: RequestBody = {
      query,
      package_name,
      language,
    };

    if (namespace) requestBody.namespace = namespace;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return (await response.json()) as ApiResponse;
  } catch (error) {
    console.error("Error making Quillopy request: ", error);
    return null;
  }
}

function formatDocument(document: Document): string {
  return [
    `Semantic Identifier: ${document.semantic_identifier}`,
    `Link: ${document.link}`,
    `Content: ${document.content}`,
  ].join("\n");
}

server.tool(
  "quillopy_search",
  "This MCP searches and fetches documentation for programming libraries and packages. When a user types @quillopy or @quillopy[package_name], they are requesting to use this tool to access programming documentation.",
  {
    query: z
      .string()
      .describe("The search query to find specific documentation"),
    package_name: z
      .string()
      .describe(
        "The name of the library or package to search documentation for"
      ),
    language: z
      .string()
      .describe(
        "The programming language of the package (e.g., python, javascript, java)"
      ),
    namespace: z
      .string()
      .optional()
      .describe(
        "Optional namespace or module within the package to narrow the search"
      ),
  },
  async ({ query, package_name, language, namespace }) => {
    const response = await makeQuillopyRequest({
      query,
      package_name: package_name.toLowerCase(),
      language: language.toLowerCase(),
      namespace: namespace?.toLowerCase(),
    });

    if (!response || !response.documents || response.documents.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No documentation found.",
          },
        ],
      };
    }

    const formattedDocs = response.documents.slice(0, 10).map(formatDocument);

    let instructionsText = "";
    if (response.instructions && response.instructions.length > 0) {
      instructionsText =
        "Instructions:\n" +
        response.instructions
          .map((instruction) => `- ${instruction}`)
          .join("\n") +
        "\n\n";
    }

    return {
      content: [
        {
          type: "text",
          text: `Found the following relevant library documentation:\n\n${formattedDocs.join(
            "\n\n"
          )}\n\n${instructionsText}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quillopy MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
