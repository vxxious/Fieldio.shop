import { preview } from "vite";

const server = await preview({
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: [{
    name: "fieldio-e2e-route-rewrites",
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
        if (request.method === "GET" && !/^\/(?:api|assets|brand|images)(?:\/|$)/.test(pathname) && !/\.[^/]+$/.test(pathname)) {
          request.url = "/app-shell.html";
        }
        next();
      });
    }
  }]
});

server.printUrls();
