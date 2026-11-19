/**
 * Routes the web app's API calls to the API running in this page. `fetch` and `EventSource`
 * calls to /api/ are answered by the in-page app; everything else goes to the network as usual.
 */
import type { DemoApp, DemoResponse, DemoStream } from './shims/fastify';

const isApi = (url: URL) => url.origin === location.origin && url.pathname.startsWith('/api/');
const isStream = (result: DemoResponse | DemoStream): result is DemoStream => 'raw' in result;

export function installFetch(app: DemoApp): void {
  const network = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!isApi(url)) return network(input, init);
    const result = await app.handle({
      method: request.method,
      url: url.pathname + url.search,
      headers: Object.fromEntries(request.headers),
      body: request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text(),
    });
    if (isStream(result)) {
      result.close();
      return new Response(null, { status: 400 });
    }
    return new Response(result.body, { status: result.status, headers: result.headers });
  };
}

/** Parses server-sent events written by the API into DOM events, as the browser's EventSource does. */
function parse(chunk: string, emit: (type: string, data: string) => void): void {
  for (const block of chunk.split('\n\n')) {
    let type = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') type = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length) emit(type, data.join('\n'));
  }
}

export function installEventSource(app: DemoApp): void {
  const Native = window.EventSource;

  class DemoEventSource extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;
    url = '';
    readonly withCredentials = false;
    readyState = 0;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    private stream: DemoStream | undefined;

    constructor(url: string | URL, init?: EventSourceInit) {
      super();
      const target = new URL(url, location.href);
      if (!isApi(target)) return new Native(url, init) as unknown as DemoEventSource;
      this.url = target.href;
      void this.connect(target);
    }

    private fire(event: Event): void {
      this.dispatchEvent(event);
      const handler = { open: this.onopen, message: this.onmessage, error: this.onerror }[event.type];
      (handler as ((e: Event) => void) | null | undefined)?.call(this, event);
    }

    private async connect(target: URL): Promise<void> {
      const result = await app.handle({
        method: 'GET',
        url: target.pathname + target.search,
        headers: { accept: 'text/event-stream' },
        body: '',
      });
      if (this.readyState === 2) {
        if (isStream(result)) result.close();
        return;
      }
      if (!isStream(result)) {
        this.readyState = 2;
        this.fire(new Event('error'));
        return;
      }
      this.stream = result;
      this.readyState = 1;
      this.fire(new Event('open'));
      result.raw.pipe((chunk) => {
        if (this.readyState !== 2) parse(chunk, (type, data) => this.fire(new MessageEvent(type, { data })));
      });
    }

    close(): void {
      this.readyState = 2;
      this.stream?.close();
    }
  }

  window.EventSource = DemoEventSource as unknown as typeof EventSource;
}
