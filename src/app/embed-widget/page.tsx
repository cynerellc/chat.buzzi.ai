"use client";

/**
 * Chat Widget Page
 *
 * This page renders inside the widget iframe and provides the full chat interface.
 * It uses the ChatWindow component and passes URL parameters as configuration.
 */

import { ChatWindow } from "./components/ChatWindow";

export default function WidgetPage() {
  return (
    <div className="h-screen w-full">
      <ChatWindow />
    </div>
  );
}
