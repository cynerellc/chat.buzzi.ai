import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, type ChatWidgetConfig } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    // Verify agent belongs to company and get widget config
    const [agent] = await db
      .select({
        id: agents.id,
        name: agents.name,
        status: agents.status,
        widgetConfig: agents.widgetConfig,
      })
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get chat widget config from unified widgetConfig
    const unifiedConfig = agent.widgetConfig as { chat?: ChatWidgetConfig; call?: Record<string, unknown> } | null;
    const widgetConfig = unifiedConfig?.chat;

    // Generate embed code
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat.buzzi.ai";
    const widgetUrl = `${baseUrl}/widget/${agentId}`;

    // Standard embed code
    const standardCode = `<!-- Buzzi Chat Widget -->
<script>
  (function(w, d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${baseUrl}/widget.js";
    js.setAttribute("data-agent-id", "${agentId}");
    fjs.parentNode.insertBefore(js, fjs);
  }(window, document, "script", "buzzi-widget"));
</script>
<!-- End Buzzi Chat Widget -->`;

    // React component code
    const reactCode = `import { BuzziChat } from '@buzzi/react-widget';

function App() {
  return (
    <BuzziChat
      agentId="${agentId}"
      ${widgetConfig?.position ? `position="${widgetConfig.position}"` : ''}
      ${widgetConfig?.theme ? `theme="${widgetConfig.theme}"` : ''}
    />
  );
}`;

    // Vue component code
    const vueCode = `<template>
  <buzzi-chat
    agent-id="${agentId}"
    ${widgetConfig?.position ? `:position="${widgetConfig.position}"` : ''}
    ${widgetConfig?.theme ? `:theme="${widgetConfig.theme}"` : ''}
  />
</template>

<script>
import { BuzziChat } from '@buzzi/vue-widget';

export default {
  components: {
    BuzziChat
  }
}
</script>`;

    // Direct iframe embed
    const iframeCode = `<iframe
  src="${widgetUrl}"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
  allow="microphone"
></iframe>`;

    // API-only integration
    const apiCode = `// Initialize chat session
const response = await fetch('${baseUrl}/api/chat/${agentId}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Hello!',
    sessionId: 'optional-session-id', // Use to maintain conversation context
    metadata: {
      // Optional user metadata
      name: 'John Doe',
      email: 'john@example.com',
    }
  })
});

const data = await response.json();
console.log(data.message); // AI response`;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      },
      embedCodes: {
        standard: {
          name: "Standard (Recommended)",
          description: "Drop-in script that works with any website",
          code: standardCode,
          language: "html",
        },
        react: {
          name: "React Component",
          description: "For React/Next.js applications",
          code: reactCode,
          language: "jsx",
        },
        vue: {
          name: "Vue Component",
          description: "For Vue.js applications",
          code: vueCode,
          language: "vue",
        },
        iframe: {
          name: "iFrame",
          description: "Simple iframe embed (less customizable)",
          code: iframeCode,
          language: "html",
        },
        api: {
          name: "API Integration",
          description: "Direct API access for custom integrations",
          code: apiCode,
          language: "javascript",
        },
      },
      urls: {
        widget: widgetUrl,
        api: `${baseUrl}/api/chat/${agentId}`,
        docs: `${baseUrl}/docs/integration`,
      },
    });
  } catch (error) {
    console.error("Error generating widget code:", error);
    return NextResponse.json(
      { error: "Failed to generate widget code" },
      { status: 500 }
    );
  }
}
