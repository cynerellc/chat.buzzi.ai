import { NextRequest, NextResponse } from "next/server";

/**
 * Widget Test Page API
 *
 * Generates a sample HTML page with the widget embedded for testing.
 * This allows users to test their widget configuration in a real environment.
 */

// Escape HTML entities to prevent XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chatbotId = searchParams.get("chatbotId");
  const companyId = searchParams.get("companyId");

  if (!chatbotId || !companyId) {
    return NextResponse.json(
      { error: "chatbotId and companyId are required" },
      { status: 400 }
    );
  }

  // Validate UUIDs to prevent injection
  if (!isValidUUID(chatbotId) || !isValidUUID(companyId)) {
    return NextResponse.json(
      { error: "Invalid chatbotId or companyId format" },
      { status: 400 }
    );
  }

  // Escape values for safe HTML embedding
  const safeChatbotId = escapeHtml(chatbotId);
  const safeCompanyId = escapeHtml(companyId);

  // Get the base URL from the request
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;
  const safeBaseUrl = escapeHtml(baseUrl);

  // Generate a sample HTML page with the widget embedded
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Test Page</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 16px 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6437F3 0%, #2b3dd8 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .badge {
      background: #fef3c7;
      color: #92400e;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .main {
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 24px;
      width: 100%;
    }

    .hero {
      text-align: center;
      margin-bottom: 48px;
    }

    .hero h1 {
      color: white;
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 16px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .hero p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      max-width: 600px;
      margin: 0 auto;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 48px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    .card h3 {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }

    .card p {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
    }

    .instructions {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .instructions h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a1a1a;
    }

    .instructions ul {
      list-style: none;
      padding: 0;
    }

    .instructions li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }

    .instructions li:last-child {
      border-bottom: none;
    }

    .step-number {
      background: #6437F3;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-content {
      color: #444;
      font-size: 14px;
      line-height: 1.5;
    }

    .footer {
      text-align: center;
      padding: 24px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }

    .footer a {
      color: white;
      text-decoration: none;
      font-weight: 500;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .hero, .card, .instructions {
      animation: fadeInUp 0.5s ease-out forwards;
    }

    .card:nth-child(2) {
      animation-delay: 0.1s;
    }

    .card:nth-child(3) {
      animation-delay: 0.2s;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <div class="logo">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <span class="logo-text">Widget Test Page</span>
      </div>
      <div class="badge">Test Environment</div>
    </div>
  </header>

  <main class="main">
    <div class="hero">
      <h1>Test Your Chat Widget</h1>
      <p>This is a sample page to test your chat widget configuration. The widget should appear in the corner of your screen.</p>
    </div>

    <div class="instructions">
      <h2>Testing Instructions</h2>
      <ul>
        <li>
          <span class="step-number">1</span>
          <span class="step-content"><strong>Open the widget</strong> - Click the chat bubble in the corner to open the chat window.</span>
        </li>
        <li>
          <span class="step-number">2</span>
          <span class="step-content"><strong>Send a message</strong> - Type a message and press Enter or click the send button to test the conversation flow.</span>
        </li>
        <li>
          <span class="step-number">3</span>
          <span class="step-content"><strong>Test voice input</strong> - If enabled, hold the microphone button to test push-to-talk voice input.</span>
        </li>
        <li>
          <span class="step-number">4</span>
          <span class="step-content"><strong>Check styling</strong> - Verify that colors, branding, and layout match your configuration.</span>
        </li>
        <li>
          <span class="step-number">5</span>
          <span class="step-content"><strong>Test agent switching</strong> - If your chatbot has multiple agents, try triggering a transfer to test notifications.</span>
        </li>
      </ul>
    </div>

    <div class="cards">
      <div class="card">
        <h3>Appearance</h3>
        <p>Check that the widget colors, position, and styling match your customization settings.</p>
      </div>
      <div class="card">
        <h3>Functionality</h3>
        <p>Test sending messages, receiving responses, and using features like emoji and voice input.</p>
      </div>
      <div class="card">
        <h3>Responsiveness</h3>
        <p>Resize your browser to test how the widget behaves on different screen sizes.</p>
      </div>
    </div>
  </main>

  <footer class="footer">
    <p>Powered by <a href="${safeBaseUrl}">Buzzi Chat</a></p>
  </footer>

  <!-- Chat Widget -->
  <div id="buzzi-chat-widget" style="position: fixed; bottom: 0; right: 0; z-index: 999999;"></div>

  <script>
    (function() {
      // Configuration (validated UUIDs only)
      var config = {
        agentId: "${safeChatbotId}",
        companyId: "${safeCompanyId}",
        baseUrl: "${safeBaseUrl}",
        primaryColor: "#6437F3",
        launcherIcon: "chat"
      };

      var container = document.getElementById("buzzi-chat-widget");
      var isOpen = false;
      var chatWindow = null;
      var launcher = null;

      // Fetch widget config from API
      fetch(config.baseUrl + "/api/widget/config?agentId=" + config.agentId + "&companyId=" + config.companyId)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.config) {
            config.primaryColor = data.config.primaryColor || config.primaryColor;
            config.launcherIcon = data.config.launcherIcon || config.launcherIcon;
            // Update launcher with new config
            if (launcher) {
              launcher.style.background = config.primaryColor;
              if (!isOpen) {
                launcher.replaceChildren(createLauncherIcon());
              }
            }
          }
        })
        .catch(function() {});

      // Create SVG elements safely (no innerHTML with user content)
      function createLauncherIcon() {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "28");
        svg.setAttribute("height", "28");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "white");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        if (config.launcherIcon === "message") {
          // Message bubble with lines icon
          var path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path1.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
          svg.appendChild(path1);
          var line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line1.setAttribute("x1", "8"); line1.setAttribute("y1", "9");
          line1.setAttribute("x2", "16"); line1.setAttribute("y2", "9");
          svg.appendChild(line1);
          var line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line2.setAttribute("x1", "8"); line2.setAttribute("y1", "13");
          line2.setAttribute("x2", "14"); line2.setAttribute("y2", "13");
          svg.appendChild(line2);
        } else if (config.launcherIcon === "help") {
          // Question mark / help icon
          var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "10");
          svg.appendChild(circle);
          var path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path1.setAttribute("d", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3");
          svg.appendChild(path1);
          var line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line1.setAttribute("x1", "12"); line1.setAttribute("y1", "17");
          line1.setAttribute("x2", "12.01"); line1.setAttribute("y2", "17");
          svg.appendChild(line1);
        } else if (config.launcherIcon === "support") {
          // Headphones / support icon
          var path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path1.setAttribute("d", "M3 18v-6a9 9 0 0 1 18 0v6");
          svg.appendChild(path1);
          var path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path2.setAttribute("d", "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z");
          svg.appendChild(path2);
        } else {
          // Default: chat bubble icon
          var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
          svg.appendChild(path);
        }

        return svg;
      }

      function createCloseIcon() {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "white");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        var line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line1.setAttribute("x1", "18");
        line1.setAttribute("y1", "6");
        line1.setAttribute("x2", "6");
        line1.setAttribute("y2", "18");
        svg.appendChild(line1);

        var line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line2.setAttribute("x1", "6");
        line2.setAttribute("y1", "6");
        line2.setAttribute("x2", "18");
        line2.setAttribute("y2", "18");
        svg.appendChild(line2);

        return svg;
      }

      // Create launcher button
      launcher = document.createElement("button");
      launcher.id = "buzzi-launcher";
      launcher.setAttribute("aria-label", "Open chat");
      launcher.style.cssText = [
        "width: 60px",
        "height: 60px",
        "border-radius: 50%",
        "border: none",
        "background: " + config.primaryColor,
        "cursor: pointer",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "margin: 20px",
        "box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15)",
        "transition: transform 0.2s ease, box-shadow 0.2s ease"
      ].join("; ");

      launcher.appendChild(createLauncherIcon());

      launcher.addEventListener("mouseenter", function() {
        launcher.style.transform = "scale(1.05)";
        launcher.style.boxShadow = "0 6px 32px rgba(0, 0, 0, 0.2)";
      });

      launcher.addEventListener("mouseleave", function() {
        launcher.style.transform = "scale(1)";
        launcher.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.15)";
      });

      launcher.addEventListener("click", function() {
        if (isOpen) {
          // Close
          if (chatWindow) {
            chatWindow.style.opacity = "0";
            chatWindow.style.transform = "translateY(20px) scale(0.95)";
          }
          launcher.replaceChildren(createLauncherIcon());
        } else {
          // Open
          if (!chatWindow) {
            chatWindow = document.createElement("div");
            chatWindow.id = "buzzi-chat-window";
            chatWindow.style.cssText = [
              "position: absolute",
              "bottom: 90px",
              "right: 20px",
              "width: 380px",
              "height: 600px",
              "max-height: calc(100vh - 120px)",
              "border-radius: 16px",
              "overflow: hidden",
              "box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15)",
              "opacity: 0",
              "transform: translateY(20px) scale(0.95)",
              "transition: opacity 0.2s ease, transform 0.2s ease"
            ].join("; ");

            var iframe = document.createElement("iframe");
            iframe.id = "buzzi-chat-iframe";
            iframe.style.cssText = "width: 100%; height: 100%; border: none;";

            var params = new URLSearchParams({
              agentId: config.agentId,
              companyId: config.companyId
            });
            iframe.src = config.baseUrl + "/embed-widget?" + params.toString();

            chatWindow.appendChild(iframe);
            container.appendChild(chatWindow);
          }

          requestAnimationFrame(function() {
            if (chatWindow) {
              chatWindow.style.opacity = "1";
              chatWindow.style.transform = "translateY(0) scale(1)";
            }
          });

          launcher.replaceChildren(createCloseIcon());
        }
        isOpen = !isOpen;
      });

      container.appendChild(launcher);
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
