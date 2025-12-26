"use client";

/**
 * Widget Demo Page for E2E Testing
 *
 * This page demonstrates the chat widget functionality for E2E tests.
 * It loads the widget with test agent and company configuration.
 */

import { useEffect, useState } from "react";

export default function WidgetDemoPage() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the first active agent for the E2E test company
    const loadWidgetConfig = async () => {
      try {
        const response = await fetch("/api/widget-demo/config");
        if (response.ok) {
          const data = await response.json();
          setAgentId(data.agentId);
          setCompanyId(data.companyId);
        }
      } catch (error) {
        console.error("Failed to load widget config:", error);
      }
    };

    loadWidgetConfig();
  }, []);

  useEffect(() => {
    if (agentId && companyId && !widgetLoaded) {
      // Load the widget script
      const script = document.createElement("script");
      script.innerHTML = `
        (function() {
          var w = window;
          w.BuzziChat = w.BuzziChat || {};
          w.BuzziChat.q = w.BuzziChat.q || [];
          w.BuzziChat.init = function(config) {
            w.BuzziChat.config = config;
            // Create widget container
            var container = document.createElement('div');
            container.id = 'buzzi-widget-container';
            document.body.appendChild(container);

            // Create widget button
            var button = document.createElement('button');
            button.id = 'buzzi-widget-button';
            button.setAttribute('aria-label', 'Open chat');
            button.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:' + (config.primaryColor || '#6437F3') + ';border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;display:flex;align-items:center;justify-content:center;';
            button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
            container.appendChild(button);

            // Create chat window
            var chatWindow = document.createElement('div');
            chatWindow.id = 'buzzi-chat-window';
            chatWindow.style.cssText = 'position:fixed;bottom:100px;right:20px;width:380px;height:600px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;display:none;flex-direction:column;overflow:hidden;';
            container.appendChild(chatWindow);

            // Create iframe for widget
            var iframe = document.createElement('iframe');
            iframe.id = 'buzzi-widget-iframe';
            iframe.title = 'Chat Widget';
            iframe.style.cssText = 'width:100%;height:100%;border:none;';
            iframe.src = '/embed-widget?agentId=' + config.agentId + '&companyId=' + config.companyId + '&theme=' + (config.theme || 'light') + '&primaryColor=' + encodeURIComponent(config.primaryColor || '#6437F3');
            chatWindow.appendChild(iframe);

            // Toggle chat window
            button.addEventListener('click', function() {
              var isVisible = chatWindow.style.display === 'flex';
              chatWindow.style.display = isVisible ? 'none' : 'flex';
              button.innerHTML = isVisible
                ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
            });

            // Listen for messages from widget
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type) {
                switch(event.data.type) {
                  case 'widget:close':
                  case 'widget:minimize':
                    chatWindow.style.display = 'none';
                    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
                    break;
                }
              }
            });
          };
        })();
      `;
      document.head.appendChild(script);

      // Initialize widget
      setTimeout(() => {
        // @ts-expect-error - BuzziChat is added by script
        if (window.BuzziChat && window.BuzziChat.init) {
          // @ts-expect-error - BuzziChat is added by script
          window.BuzziChat.init({
            agentId: agentId,
            companyId: companyId,
            theme: "light",
            primaryColor: "#6437F3",
          });
          setWidgetLoaded(true);
        }
      }, 100);
    }
  }, [agentId, companyId, widgetLoaded]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Widget Demo Page
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            This is a demo page for testing the chat widget. Click the chat
            button in the bottom right corner to open the widget.
          </p>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Scenarios</h2>
            <ul className="text-left space-y-2 text-gray-600">
              <li>✓ Ask about product installation</li>
              <li>✓ Ask about system requirements</li>
              <li>✓ Ask about refund policy</li>
              <li>✓ Request to speak with a human agent</li>
              <li>✓ Express frustration to trigger escalation</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This page is for E2E testing purposes only.
              {!widgetLoaded && " Loading widget..."}
              {widgetLoaded && " Widget is ready!"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
