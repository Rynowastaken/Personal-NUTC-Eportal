import test from "node:test";
import assert from "node:assert/strict";

import {
  askTutor,
  buildTutorMessages,
  validateAiHistory,
  validateAiQuestion,
} from "../src/ai-tutor.js";
import {
  DashboardPreferenceStore,
  validateAiSettings,
} from "../src/dashboard-preferences.js";

const DEFAULT_AI = {
  enabled: false,
  provider: "opencode-go",
  baseUrl: "https://opencode.ai/inference/go/openai/v1",
  model: "deepseek-v4.1-flash",
  apiKey: "",
  session: "",
};

const QUESTION = {
  stem: "2 + 2 等於多少？",
  type: "single_selection",
  options: [
    { index: 1, text: "3" },
    { index: 2, text: "4" },
  ],
  selected: ["2"],
  text: "我認為是 4",
};

test("validateAiSettings returns safe defaults", () => {
  assert.deepEqual(validateAiSettings({}), DEFAULT_AI);
});

test("validateAiSettings accepts explicit provider presets", () => {
  const settings = validateAiSettings({
    enabled: true,
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-test",
  });
  assert.deepEqual(settings, {
    enabled: true,
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-test",
    session: "",
  });
});

test("validateAiSettings fills opencode-go defaults for empty URL and model", () => {
  const settings = validateAiSettings({ baseUrl: "", model: "" });
  assert.equal(settings.baseUrl, DEFAULT_AI.baseUrl);
  assert.equal(settings.model, DEFAULT_AI.model);
});

test("validateAiSettings preserves the stored key unless cleared", () => {
  const previous = validateAiSettings({
    enabled: true,
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    model: "gpt-4o-mini",
    apiKey: "secret-key",
  });

  const preserved = validateAiSettings({ model: "gpt-4.1-mini" }, previous);
  assert.equal(preserved.apiKey, "secret-key");
  assert.equal(preserved.enabled, true);

  const cleared = validateAiSettings({ clearKey: true }, previous);
  assert.equal(cleared.apiKey, "");
  assert.equal(cleared.model, "gpt-4o-mini");
});

test("validateAiSettings rejects unknown providers and insecure remote URLs", () => {
  assert.throws(
    () => validateAiSettings({ provider: "anthropic" }),
    /provider must be opencode-go or openai/,
  );
  assert.throws(
    () =>
      validateAiSettings({
        enabled: true,
        provider: "openai",
        baseUrl: "http://api.example.test/v1",
        model: "gpt-4o-mini",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      validateAiSettings({
        enabled: true,
        provider: "openai",
        baseUrl: "https://user:pass@api.example.test/v1",
        model: "gpt-4o-mini",
      }),
    /credentials/,
  );
});

test("validateAiSettings allows HTTP only for localhost", () => {
  const settings = validateAiSettings({
    enabled: true,
    provider: "openai",
    baseUrl: "http://127.0.0.1:8080/v1",
    model: "local-model",
    apiKey: "local-key",
  });
  assert.equal(settings.baseUrl, "http://127.0.0.1:8080/v1");
});

test("get() exposes hasKey but never the API key", () => {
  const store = new DashboardPreferenceStore();
  store.value.ai = {
    enabled: true,
    provider: "opencode-go",
    baseUrl: "https://provider.test/v1",
    model: "deepseek-v4.1-flash",
    apiKey: "super-secret-key",
    session: "portal-test",
  };

  const publicView = store.get().ai;
  assert.deepEqual(publicView, {
    enabled: true,
    provider: "opencode-go",
    baseUrl: "https://provider.test/v1",
    model: "deepseek-v4.1-flash",
    hasKey: true,
    session: "portal-test",
  });
  assert.equal(Object.hasOwn(publicView, "apiKey"), false);
  assert.equal(JSON.stringify(store.get()).includes("super-secret-key"), false);
  assert.equal(store.aiConfig().apiKey, "super-secret-key");
});

test("validateAiQuestion normalizes the question and enforces limits", () => {
  const question = validateAiQuestion(QUESTION);
  assert.deepEqual(question, {
    stem: QUESTION.stem,
    type: "single_selection",
    options: [
      { index: 1, text: "3" },
      { index: 2, text: "4" },
    ],
    selected: ["2"],
    text: "我認為是 4",
  });

  assert.throws(
    () => validateAiQuestion({ stem: "x".repeat(8001) }),
    /8000 characters or fewer/,
  );
  assert.throws(
    () =>
      validateAiQuestion({
        stem: "x",
        options: [{ index: 0, text: "bad" }],
      }),
    /Option index/,
  );
  assert.throws(
    () => validateAiQuestion({ stem: "x", selected: [1] }),
    /must be a string/,
  );
  assert.throws(
    () =>
      validateAiQuestion({
        stem: "x",
        options: Array.from({ length: 31 }, (_, index) => ({
          index: index + 1,
          text: "option",
        })),
      }),
    /at most 30/,
  );
});

test("buildTutorMessages builds the practice-question prompt", () => {
  const question = validateAiQuestion(QUESTION);
  const messages = buildTutorMessages(question);

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /練習測驗/);
  assert.match(messages[0].content, /選項/);
  assert.match(messages[0].content, /建議的答案/);
  assert.match(messages[0].content, /繁體中文/);
  // The tutor is taught the answer format the page can render: LaTeX math and
  // chart blocks with a strict JSON shape.
  assert.match(messages[0].content, /LaTeX/);
  assert.match(messages[0].content, /\$\.\.\.\$/);
  assert.match(messages[0].content, /```chart/);
  assert.match(messages[0].content, /"type":"line"/);
  assert.match(messages[0].content, /points: \[\[x,y\],\.\.\.\]/);
  assert.match(messages[0].content, /domain: \[a,b\]/);
  assert.match(messages[0].content, /categories/);
  assert.match(messages[0].content, /最多 6 條 series/);
  assert.match(messages[0].content, /title、xLabel、yLabel/);
  assert.match(messages[0].content, /純文字/);

  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /題型：single_selection/);
  assert.match(messages[1].content, /題目：2 \+ 2 等於多少？/);
  assert.match(messages[1].content, /1\. 3/);
  assert.match(messages[1].content, /2\. 4/);
  assert.match(messages[1].content, /學生目前的選擇：2/);
  assert.match(messages[1].content, /學生填寫的答案：我認為是 4/);
});

test("buildTutorMessages marks unanswered questions", () => {
  const messages = buildTutorMessages(
    validateAiQuestion({ stem: "尚未作答的題目" }),
  );
  assert.match(messages[1].content, /學生目前的選擇：尚未作答/);
  assert.doesNotMatch(messages[1].content, /學生填寫的答案/);
});

test("buildTutorMessages appends follow-up history", () => {
  const history = validateAiHistory([
    { role: "assistant", content: "先前的解說" },
    { role: "user", content: "為什麼？" },
  ]);
  const messages = buildTutorMessages(validateAiQuestion(QUESTION), history);

  assert.equal(messages.length, 4);
  assert.match(messages[0].content, /追問/);
  assert.deepEqual(messages.slice(2), history);
});

test("validateAiHistory rejects bad turns and oversized history", () => {
  assert.throws(() => validateAiHistory("no"), /array/);
  assert.throws(
    () => validateAiHistory([{ role: "system", content: "x" }]),
    /role/,
  );
  assert.throws(
    () => validateAiHistory([{ role: "user", content: "  " }]),
    /empty/,
  );
  assert.throws(
    () =>
      validateAiHistory(
        Array.from({ length: 9 }, () => ({ role: "user", content: "x" })),
      ),
    /at most 8/,
  );
  assert.throws(
    () =>
      validateAiHistory([{ role: "user", content: "x".repeat(12001) }]),
    /12000/,
  );
  assert.throws(
    () =>
      validateAiHistory(
        Array.from({ length: 3 }, () => ({
          role: "user",
          content: "x".repeat(9000),
        })),
      ),
    /24000/,
  );
});

test("askTutor sends follow-up history after the original question", async () => {
  const captured = {};
  const history = [
    { role: "assistant", content: "先前的解說" },
    { role: "user", content: "為什麼？" },
  ];
  await askTutor(
    {
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
    },
    validateAiQuestion(QUESTION),
    { history, fetchImpl: capturingFetch(answerResponse("ok"), captured) },
  );

  assert.equal(captured.body.messages.length, 4);
  assert.deepEqual(captured.body.messages.slice(2), history);
});

function capturingFetch(response, captured) {
  return async (url, init) => {
    captured.url = url;
    captured.init = init;
    captured.headers = init.headers;
    captured.body = JSON.parse(init.body);
    return response;
  };
}

function answerResponse(content) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content } }] };
    },
  };
}

test("askTutor calls opencode-go with auth and session headers", async () => {
  const question = validateAiQuestion(QUESTION);
  const captured = {};
  const answer = await askTutor(
    {
      enabled: true,
      provider: "opencode-go",
      baseUrl: "https://provider.test/v1/",
      model: "deepseek-v4.1-flash",
      apiKey: "secret-key",
      session: "portal-session",
    },
    question,
    { fetchImpl: capturingFetch(answerResponse("  這是答案  "), captured) },
  );

  assert.equal(answer, "這是答案");
  assert.equal(captured.url, "https://provider.test/v1/chat/completions");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.headers.Authorization, "Bearer secret-key");
  assert.equal(captured.headers["Content-Type"], "application/json");
  assert.equal(captured.headers["x-opencode-session"], "portal-session");
  assert.equal(captured.body.model, "deepseek-v4.1-flash");
  assert.equal(captured.body.temperature, 0.2);
  assert.equal(captured.body.max_tokens, 1600);
  assert.equal(captured.body.messages[0].role, "system");
  assert.equal(captured.body.messages[1].role, "user");
  assert.ok(captured.init.signal, "a 60 s timeout signal is attached");
});

test("askTutor omits the opencode-go session header for other providers", async () => {
  const captured = {};
  const answer = await askTutor(
    {
      enabled: true,
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4o-mini",
      apiKey: "openai-key",
      session: "portal-unused",
    },
    validateAiQuestion(QUESTION),
    { fetchImpl: capturingFetch(answerResponse("ok"), captured) },
  );

  assert.equal(answer, "ok");
  assert.equal(captured.url, "https://api.example.test/v1/chat/completions");
  assert.equal(captured.headers.Authorization, "Bearer openai-key");
  assert.equal(Object.hasOwn(captured.headers, "x-opencode-session"), false);
});

test("askTutor joins array content and caps the answer", async () => {
  const joined = await askTutor(
    {
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
    },
    validateAiQuestion(QUESTION),
    {
      fetchImpl: capturingFetch(
        answerResponse(["第一段", "", "第二段"]),
        {},
      ),
    },
  );
  assert.equal(joined, "第一段第二段");

  const long = await askTutor(
    {
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
    },
    validateAiQuestion(QUESTION),
    { fetchImpl: capturingFetch(answerResponse("x".repeat(20000)), {}) },
  );
  assert.equal(long.length, 16000);
});

test("askTutor reports upstream failures without leaking the key", async () => {
  const config = {
    provider: "openai",
    baseUrl: "https://api.example.test/v1",
    model: "gpt-4o-mini",
    apiKey: "secret-key",
  };
  const question = validateAiQuestion(QUESTION);

  await assert.rejects(
    askTutor(config, question, {
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        body: { async cancel() {} },
      }),
    }),
    (error) =>
      error.statusCode === 502 &&
      /HTTP 500/.test(error.message) &&
      !error.message.includes("secret-key"),
  );

  await assert.rejects(
    askTutor(config, question, {
      fetchImpl: async () => answerResponse(undefined),
    }),
    (error) => error.statusCode === 502,
  );

  await assert.rejects(
    askTutor(config, question, {
      fetchImpl: async () => {
        throw new Error("network down");
      },
    }),
    (error) =>
      error.statusCode === 502 && !error.message.includes("secret-key"),
  );
});
