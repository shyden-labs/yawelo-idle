// tests/unit/fixtures/worker-coverage/fixture-worker.ts
var Counter = class {
  hello() {
    return "hi";
  }
};
var fixture_worker_default = {
  fetch(request) {
    if (new URL(request.url).pathname === "/a") {
      return new Response("a");
    }
    return new Response("other");
  },
  scheduled() {
    return "ran";
  }
};
export {
  Counter,
  fixture_worker_default as default
};
//# sourceMappingURL=bundle.js.map
