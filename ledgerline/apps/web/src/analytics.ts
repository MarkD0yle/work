/**
 * Analytics events (SPEC §12). Events go to pluggable sinks; in development the sink is the console.
 * Nothing here sends data anywhere by itself: a real sink is added when a measurement tool is chosen.
 */
export type AnalyticsEvent =
  | 'view.saved'
  | 'view.applied'
  | 'action.invoked'
  | 'bulk.submitted'
  | 'bulk.retried'
  | 'import.committed'
  | 'exception.resolved'
  | 'period.closed';

export type AnalyticsSink = (event: AnalyticsEvent, properties: Record<string, unknown>) => void;

const consoleSink: AnalyticsSink = (event, properties) => console.info(`[analytics] ${event}`, properties);

const sinks = new Set<AnalyticsSink>(import.meta.env.DEV ? [consoleSink] : []);

/** Adds a sink. Returns a function that removes it. */
export function addAnalyticsSink(sink: AnalyticsSink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

/** Records an event. Never throws: a broken sink must not break the screen. */
export function track(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  for (const sink of sinks) {
    try {
      sink(event, properties);
    } catch {
      // A sink failure is not the user's problem.
    }
  }
}
