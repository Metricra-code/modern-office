import { resolve, sep } from 'node:path';
const root = resolve('out');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const server = Bun.serve({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3100),
  async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Invalid path', { status: 400 });
    }
    if (basePath && !(pathname === basePath || pathname.startsWith(`${basePath}/`)))
      return new Response('Not found', { status: 404 });
    const relative = (basePath ? pathname.slice(basePath.length) : pathname) || '/';
    const path = resolve(root, `.${relative.endsWith('/') ? `${relative}index.html` : relative}`);
    if (!path.startsWith(`${root}${sep}`)) return new Response('Not found', { status: 404 });
    if (!relative.endsWith('/') && (await Bun.file(resolve(path, 'index.html')).exists())) {
      const url = new URL(request.url);
      url.pathname += '/';
      return Response.redirect(url.href, 308);
    }
    let file = Bun.file(path);
    if (!(await file.exists())) {
      file = Bun.file(resolve(root, '404.html'));
      return new Response(request.method === 'HEAD' ? null : file, { status: 404 });
    }
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: {
        'Content-Type': file.type,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(self), microphone=(self)',
        'Cache-Control': relative.startsWith('/_next/static/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      },
    });
  },
});
console.info(
  JSON.stringify({
    event: 'static.started',
    url: `http://${server.hostname}:${server.port}${basePath}/`,
  }),
);
