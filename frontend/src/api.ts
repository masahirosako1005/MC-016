export class ApiError extends Error {
  code: string;
  status: number;
  requestId: string;
  constructor(status: number, code: string, detail: string, requestId: string) {
    super(detail);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type Listener = (msg: string, kind: "error" | "info") => void;
const listeners = new Set<Listener>();
export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function toast(msg: string, kind: "error" | "info" = "info") {
  listeners.forEach((l) => l(msg, kind));
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  let code = "error";
  let detail = "エラーが発生しました";
  let rid = "";
  try {
    const j = await res.json();
    code = j.code ?? code;
    detail = j.detail ?? detail;
    rid = j.request_id ?? "";
  } catch {
    /* ignore */
  }
  throw new ApiError(res.status, code, detail, rid);
}

export async function get<T>(path: string): Promise<T> {
  return handle<T>(await fetch(`/api${path}`, { headers: { Accept: "application/json" } }));
}

export async function send<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function sendForm<T>(path: string, form: FormData): Promise<T> {
  return handle<T>(await fetch(`/api${path}`, { method: "POST", body: form }));
}

export const post = <T>(path: string, body?: unknown) => send<T>("POST", path, body);
export const put = <T>(path: string, body?: unknown) => send<T>("PUT", path, body);
export const del = <T>(path: string, body?: unknown) => send<T>("DELETE", path, body);
