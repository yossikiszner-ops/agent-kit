/**
 * app/page.js — Main page
 *
 * Server Component — reads agent config and env, passes to ChatWindow.
 * The actual chat UI is a Client Component (ChatWindow).
 */

import { ChatWindow } from "@/components/chat/ChatWindow.jsx";
import { agentIdentity } from "@/lib/env.js";
import agentConfig from "@/agent.config.js";

export default function Page() {
  return (
    <ChatWindow
      agentName={agentIdentity.name}
      agentColor={agentIdentity.color}
      agentInitials={agentIdentity.initials}
      welcomeMessage={agentIdentity.welcome}
      suggestedPrompts={agentConfig.ui.suggestedPrompts ?? []}
      showToolCalls={agentConfig.ui.showToolCalls}
      showBranding={agentIdentity.showBranding}
    />
  );
}
