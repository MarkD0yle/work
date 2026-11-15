import { useCallback, useEffect, useRef } from 'react';

/** Messages that keep a workspace and its pop-out windows in step (SPEC 7.1: pop out, 7.2: workspaces). */
export type WorkspaceMessage =
  /** The main window asks which panels are popped out. */
  | { type: 'who' }
  /** A pop-out window says it is showing a panel. */
  | { type: 'open'; panel: number }
  | { type: 'closed'; panel: number }
  /** The main window asks a pop-out to close ("Bring back"). */
  | { type: 'close'; panel: number }
  /** Someone refreshed: every other window reloads its data too. */
  | { type: 'refresh' }
  /** A pop-out reports how many rows are selected, so the main window can show it. */
  | { type: 'selection'; panel: number; count: number };

/**
 * A BroadcastChannel for one workspace. Messages reach every other window of the same browser profile;
 * the sender never receives its own.
 */
export function useWorkspaceChannel(
  workspaceId: string | undefined,
  onMessage: (message: WorkspaceMessage) => void,
) {
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!workspaceId || typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(`ll-workspace-${workspaceId}`);
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<WorkspaceMessage>) => handler.current(event.data);
    return () => {
      channel.current = null;
      bc.close();
    };
  }, [workspaceId]);

  // Stable sender: safe to use in effect dependencies.
  return useCallback((message: WorkspaceMessage) => channel.current?.postMessage(message), []);
}
