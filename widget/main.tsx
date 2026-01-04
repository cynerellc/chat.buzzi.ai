/**
 * Preact Widget Entry Point
 *
 * This is the main entry point for the standalone Preact chat widget bundle.
 * It renders the ChatWindow component using Preact instead of React for smaller bundle size.
 *
 * Note: This file uses preact/compat to provide React compatibility,
 * allowing the same ChatWindow component to work in both Next.js (React) and standalone (Preact) builds.
 */

import { render } from "preact";
import { ChatWindow } from "../src/app/embed-widget/components/ChatWindow";
import "../src/app/globals.css";

// Mount the chat window
const container = document.getElementById("buzzi-widget-root");

if (container) {
  render(<ChatWindow />, container);
} else {
  // If no root element, create one
  const root = document.createElement("div");
  root.id = "buzzi-widget-root";
  root.style.cssText = "width: 100%; height: 100%;";
  document.body.appendChild(root);
  render(<ChatWindow />, root);
}
