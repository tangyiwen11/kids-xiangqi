import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        host: "localhost",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the children's Xiangqi game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>儿童象棋｜认真陪你下好每一步<\/title>/);
  assert.match(html, /儿童象棋/);
  assert.match(html, /认真陪你下好每一步/);
  assert.match(html, /悔棋/);
  assert.match(html, /提示一下/);
  assert.match(html, /重新开始/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
