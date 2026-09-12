import type { Plugin } from "vite";

export function localApi(): Plugin {
  return {
    name: "fieldio-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://localhost");
        if (!/^\/api\/(order-requests|newsletter|newsletter-preferences|contact|wholesale|sitemap|render|locale|rates)$/.test(url.pathname)) { next(); return; }
        try {
          const module = await server.ssrLoadModule(`${url.pathname}.ts`) as Record<string, unknown>;
          const method = request.method || "GET";
          const handler = module[method];
          if (typeof handler !== "function") { response.writeHead(405); response.end(); return; }
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > 32768) { response.writeHead(413); response.end(); return; }
            chunks.push(buffer);
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
          const webRequest = new Request(url, { method, headers, ...(!["GET", "HEAD"].includes(method) ? { body: Buffer.concat(chunks) } : {}) });
          const result: unknown = await handler(webRequest);
          if (!(result instanceof Response)) throw new Error("Invalid API response");
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch {
          response.writeHead(500, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "The local API request could not be completed." }));
        }
      });
    }
  };
}
