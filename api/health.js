export const config = { runtime: 'edge' };

export default function handler(req) {
  return new Response(JSON.stringify({ status: 'ok', time: Date.now() }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
