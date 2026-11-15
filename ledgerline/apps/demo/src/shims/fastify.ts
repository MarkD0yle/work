/**
 * A browser stand-in for the slice of Fastify the Ledgerline API uses: route registration,
 * the onRequest and onClose hooks, error and not-found handlers, decorate, and a reply with
 * code / header / send / hijack. Requests arrive through `handle()` instead of a socket.
 */

type Headers = Record<string, string>;
type Handler = (request: DemoRequest, reply: DemoReply) => unknown;
type Hook = (request: DemoRequest, reply: DemoReply) => unknown;
type ErrorHandler = (error: unknown, request: DemoRequest, reply: DemoReply) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** A tiny event emitter, enough for `request.raw.on('close')`. */
class Emitter {
  private readonly listeners = new Map<string, Array<() => void>>();
  on(event: string, fn: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
    return this;
  }
  emit(event: string): void {
    for (const fn of this.listeners.get(event) ?? []) fn();
  }
}

/** What a hijacked reply writes to: an event stream for the EventSource stand-in. */
export class RawStream {
  status = 200;
  headers: Headers = {};
  private pending: string[] = [];
  private sink: ((chunk: string) => void) | undefined;

  writeHead(status: number, headers: Record<string, string> = {}): this {
    this.status = status;
    this.headers = headers;
    return this;
  }
  write(chunk: string): boolean {
    if (this.sink) this.sink(chunk);
    else this.pending.push(chunk);
    return true;
  }
  end(): void {}
  /** Connects the reader. Anything written before it connected is delivered first. */
  pipe(sink: (chunk: string) => void): void {
    this.sink = sink;
    for (const chunk of this.pending.splice(0)) sink(chunk);
  }
}

export interface DemoRequest {
  method: string;
  url: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Headers;
  body: unknown;
  raw: Emitter;
  [key: string]: unknown;
}

export class DemoReply {
  statusCode = 200;
  headers: Headers = {};
  payload: unknown = undefined;
  sent = false;
  hijacked = false;
  readonly raw = new RawStream();

  code(status: number): this {
    this.statusCode = status;
    return this;
  }
  status(status: number): this {
    return this.code(status);
  }
  header(name: string, value: string | number): this {
    this.headers[name.toLowerCase()] = String(value);
    return this;
  }
  type(contentType: string): this {
    return this.header('content-type', contentType);
  }
  getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }
  send(payload?: unknown): this {
    this.payload = payload;
    this.sent = true;
    return this;
  }
  hijack(): this {
    this.hijacked = true;
    return this;
  }
}

export interface DemoResponse {
  status: number;
  headers: Headers;
  body: BodyInit | null;
}

/** A hijacked request: the stream and a way to end it, as a closed socket would. */
export interface DemoStream {
  raw: RawStream;
  close: () => void;
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split('/')
    .map((segment) => {
      const param = /^:(\w+)(\?)?$/.exec(segment);
      if (!param) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      keys.push(param[1]!);
      return param[2] ? '?([^/]*)' : '([^/]+)';
    })
    .join('/');
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

/** Fastify's default query parser: repeated keys become arrays. */
function parseQuery(search: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return query;
}

class BadRequest extends Error {
  readonly statusCode = 400;
}

function serialize(reply: DemoReply): DemoResponse {
  const headers = { ...reply.headers };
  const { payload } = reply;
  let body: BodyInit | null;
  if (payload === undefined || reply.statusCode === 204 || reply.statusCode === 304) {
    body = null;
  } else if (typeof payload === 'string') {
    headers['content-type'] ??= 'text/plain; charset=utf-8';
    body = payload;
  } else if (payload instanceof Uint8Array) {
    headers['content-type'] ??= 'application/octet-stream';
    body = new Uint8Array(payload).buffer;
  } else {
    headers['content-type'] ??= 'application/json; charset=utf-8';
    body = JSON.stringify(payload);
  }
  return { status: reply.statusCode, headers, body };
}

export class DemoApp {
  private readonly routes: Route[] = [];
  private readonly hooks = { onRequest: [] as Hook[], onClose: [] as Array<() => unknown> };
  private errorHandler: ErrorHandler | undefined;
  private notFoundHandler: Handler | undefined;
  readonly log = {
    error: (...args: unknown[]) => console.error('[ledgerline demo api]', ...args),
    warn: (...args: unknown[]) => console.warn('[ledgerline demo api]', ...args),
    info: () => {},
    debug: () => {},
  };
  [decoration: string]: unknown;

  private add(method: string, path: string, a: unknown, b?: unknown): this {
    const handler = (typeof a === 'function' ? a : b) as Handler;
    this.routes.push({ method, handler, ...compile(path) });
    return this;
  }
  get(path: string, a: unknown, b?: unknown) {
    return this.add('GET', path, a, b);
  }
  post(path: string, a: unknown, b?: unknown) {
    return this.add('POST', path, a, b);
  }
  put(path: string, a: unknown, b?: unknown) {
    return this.add('PUT', path, a, b);
  }
  patch(path: string, a: unknown, b?: unknown) {
    return this.add('PATCH', path, a, b);
  }
  delete(path: string, a: unknown, b?: unknown) {
    return this.add('DELETE', path, a, b);
  }

  /** Plugins are not needed in the browser: CORS is the only one, and requests never leave the page. */
  register(): this {
    return this;
  }
  decorate(name: string, value: unknown): this {
    this[name] = value;
    return this;
  }
  addHook(name: 'onRequest' | 'onClose', fn: Hook): this {
    (this.hooks[name] as Hook[]).push(fn);
    return this;
  }
  setErrorHandler(fn: ErrorHandler): this {
    this.errorHandler = fn;
    return this;
  }
  setNotFoundHandler(fn: Handler): this {
    this.notFoundHandler = fn;
    return this;
  }
  async close(): Promise<void> {
    for (const fn of this.hooks.onClose) await fn();
  }

  /**
   * Serves one request. Returns the response, or for a hijacked reply (the job event stream)
   * the open stream.
   */
  async handle(input: {
    method: string;
    url: string;
    headers: Headers;
    body: string;
  }): Promise<DemoResponse | DemoStream> {
    const [path = '', search = ''] = input.url.split('?');
    const reply = new DemoReply();
    const request: DemoRequest = {
      method: input.method.toUpperCase(),
      url: input.url,
      params: {},
      query: parseQuery(search),
      headers: Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v])),
      body: undefined,
      raw: new Emitter(),
    };

    try {
      if (input.body && (request.headers['content-type'] ?? '').includes('application/json')) {
        try {
          request.body = JSON.parse(input.body);
        } catch {
          throw new BadRequest('Body is not valid JSON');
        }
      } else if (input.body) {
        request.body = input.body;
      }

      for (const hook of this.hooks.onRequest) {
        await hook(request, reply);
        if (reply.sent) return serialize(reply);
      }

      // As in Fastify, a static segment beats a parameter: /jobs/stream wins over /jobs/:id.
      let route: Route | undefined;
      let values: RegExpExecArray | undefined;
      for (const candidate of this.routes) {
        if (candidate.method !== request.method) continue;
        const match = candidate.pattern.exec(path);
        if (!match || (route && candidate.keys.length >= route.keys.length)) continue;
        route = candidate;
        values = match;
      }
      route?.keys.forEach((key, i) => {
        request.params[key] = decodeURIComponent(values?.[i + 1] ?? '');
      });

      if (!route) {
        if (this.notFoundHandler) await this.notFoundHandler(request, reply);
        return serialize(reply);
      }

      const result = await route.handler(request, reply);
      if (reply.hijacked) return { raw: reply.raw, close: () => request.raw.emit('close') };
      if (!reply.sent && result !== reply) reply.send(result);
      return serialize(reply);
    } catch (error) {
      const fresh = new DemoReply();
      if (this.errorHandler) await this.errorHandler(error, request, fresh);
      else fresh.code(500).send({ messages: [] });
      return serialize(fresh);
    }
  }
}

export type FastifyInstance = DemoApp;

export default function Fastify(_options?: unknown): DemoApp {
  return new DemoApp();
}
