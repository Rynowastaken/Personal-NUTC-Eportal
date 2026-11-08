// Practice-exam AI tutor.
//
// The browser sends the question it is looking at; this module validates it,
// builds the tutor prompt, and calls the configured OpenAI-compatible
// provider. Provider settings (including the API key) stay on the server.

const LIMITS = {
  stem: 8000,
  type: 40,
  options: 30,
  optionText: 2000,
  selected: 30,
  selectedText: 120,
  text: 4000,
  answer: 16000,
  historyMessages: 8,
  historyContent: 12000,
  historyTotal: 24000,
};

function questionError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function providerError(message) {
  return Object.assign(new Error(message), { statusCode: 502 });
}

function textField(value, name, max) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw questionError(`${name} must be a string.`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw questionError(`${name} must be ${max} characters or fewer.`);
  }
  return text;
}

export function validateAiQuestion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw questionError("Question details must be an object.");
  }

  const stem = textField(input.stem, "Question stem", LIMITS.stem);
  const type = textField(input.type, "Question type", LIMITS.type);
  const text = textField(input.text, "Typed answer", LIMITS.text);

  const rawOptions = input.options === undefined ? [] : input.options;
  if (!Array.isArray(rawOptions)) {
    throw questionError("Options must be an array.");
  }
  if (rawOptions.length > LIMITS.options) {
    throw questionError(`Options must contain at most ${LIMITS.options} items.`);
  }
  const options = rawOptions.map((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
      throw questionError("Each option must be an object.");
    }
    const index = Number(option.index);
    if (!Number.isInteger(index) || index < 1 || index > 99) {
      throw questionError("Option index must be an integer from 1 to 99.");
    }
    if (typeof option.text !== "string") {
      throw questionError("Option text must be a string.");
    }
    const optionText = option.text.trim();
    if (optionText.length > LIMITS.optionText) {
      throw questionError(
        `Option text must be ${LIMITS.optionText} characters or fewer.`,
      );
    }
    return { index, text: optionText };
  });

  const rawSelected = input.selected === undefined ? [] : input.selected;
  if (!Array.isArray(rawSelected)) {
    throw questionError("Selected answers must be an array.");
  }
  if (rawSelected.length > LIMITS.selected) {
    throw questionError(
      `Selected answers must contain at most ${LIMITS.selected} items.`,
    );
  }
  const selected = rawSelected.map((value) => {
    if (typeof value !== "string") {
      throw questionError("Each selected answer must be a string.");
    }
    const answer = value.trim();
    if (answer.length > LIMITS.selectedText) {
      throw questionError(
        `Each selected answer must be ${LIMITS.selectedText} characters or fewer.`,
      );
    }
    return answer;
  });

  return { stem, type, options, selected, text };
}

export function validateAiHistory(input) {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    throw questionError("Conversation history must be an array.");
  }
  if (input.length > LIMITS.historyMessages) {
    throw questionError(
      `Conversation history must contain at most ${LIMITS.historyMessages} messages.`,
    );
  }
  let total = 0;
  return input.map((turn) => {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
      throw questionError("Each history message must be an object.");
    }
    if (!["user", "assistant"].includes(turn.role)) {
      throw questionError("History role must be user or assistant.");
    }
    if (typeof turn.content !== "string") {
      throw questionError("History content must be a string.");
    }
    const content = turn.content.trim();
    if (!content) {
      throw questionError("History content must not be empty.");
    }
    if (content.length > LIMITS.historyContent) {
      throw questionError(
        `Each history message must be ${LIMITS.historyContent} characters or fewer.`,
      );
    }
    total += content.length;
    if (total > LIMITS.historyTotal) {
      throw questionError(
        `Conversation history must be ${LIMITS.historyTotal} characters or fewer.`,
      );
    }
    return { role: turn.role, content };
  });
}

const SYSTEM_PROMPT =
  "你是一位有耐心的家教，正在協助學生理解一道「練習測驗」題目。" +
  "請先說明這道題目考查的核心概念，接著逐一解釋每個選項為什麼正確或錯誤，" +
  "最後清楚指出建議的答案。請使用繁體中文，以簡潔、易讀的白話段落說明；" +
  "不要使用 Markdown 表格或標題，也不要在回覆中提及任何個人資料。" +
  "\n\n數學式一律使用 LaTeX：行內公式寫成 $...$，獨立公式寫成 $$...$$，" +
  "數學式不要放進程式碼區塊。需要畫圖時（例如函數曲線、供需曲線、成本線或長條比較），" +
  "在解說中插入一個 chart 區塊，內容必須是單一合法的 JSON，例如：\n" +
  "```chart\n" +
  '{"type":"line","title":"需求曲線","xLabel":"數量","yLabel":"價格",' +
  '"series":[{"label":"需求","points":[[0,10],[2,8],[4,6]]}]}\n' +
  "```\n" +
  "規則：type 可用 line、bar、scatter；line 與 scatter 的每個 series 用 points: [[x,y],...]" +
  "（最多 120 點），或改用 function 搭配 domain: [a,b] 畫函數，例如 " +
  '{"label":"y = x²","function":"x^2","domain":[-3,3]}；bar 用 categories: ["甲","乙"]' +
  "搭配每個 series 的 values: [數值,...]，數值個數要與 categories 相同。" +
  "function 可用 x、pi、e、+ - * / ^、括號，以及 sin、cos、tan、sqrt、abs、exp、ln、" +
  "log（以 10 為底），乘法請寫 *。最多 6 條 series，每個 chart 區塊只畫一張圖；" +
  "只有圖能幫助理解時才畫，其餘情況保持純文字。JSON 不要加註解或結尾逗號。";

export function buildTutorMessages(question, history = []) {
  const type = question?.type || "未提供";
  const stem = question?.stem || "（未提供題目）";
  const options = Array.isArray(question?.options) ? question.options : [];
  const selected = Array.isArray(question?.selected) ? question.selected : [];
  const text = typeof question?.text === "string" ? question.text : "";

  const lines = [`題型：${type}`, `題目：${stem}`];
  if (options.length) {
    lines.push("選項：");
    for (const option of options) {
      lines.push(`${option.index}. ${option.text}`);
    }
  } else {
    lines.push("選項：無");
  }
  lines.push(
    `學生目前的選擇：${selected.length ? selected.join("、") : "尚未作答"}`,
  );
  if (text) lines.push(`學生填寫的答案：${text}`);

  const system = history.length
    ? `${SYSTEM_PROMPT} 這是同一道練習題的追問，請延續先前的解說回答。`
    : SYSTEM_PROMPT;

  return [
    { role: "system", content: system },
    { role: "user", content: lines.join("\n") },
    ...history,
  ];
}

export async function askTutor(
  config,
  question,
  { history = [], fetchImpl = fetch } = {},
) {
  const baseUrl =
    typeof config?.baseUrl === "string" ? config.baseUrl.replace(/\/+$/, "") : "";
  if (!baseUrl) throw providerError("AI 服務尚未設定。");
  const turns = validateAiHistory(history);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey || ""}`,
  };
  if (config.provider === "opencode-go") {
    headers["x-opencode-session"] = config.session || "portal-ai";
  }

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: buildTutorMessages(question, turns),
        temperature: 0.2,
        max_tokens: 1600,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw providerError(
      `AI 服務沒有回應（${error?.name || "network error"}）。`,
    );
  }

  if (!response?.ok) {
    try {
      await response?.body?.cancel?.();
    } catch {
      // The response body is already unusable; nothing else to clean up.
    }
    throw providerError(
      `AI 服務回應錯誤（HTTP ${response?.status ?? "unknown"}）。`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw providerError("AI 服務回應格式不正確。");
  }

  const content = data?.choices?.[0]?.message?.content;
  let answer;
  if (typeof content === "string") {
    answer = content;
  } else if (Array.isArray(content)) {
    answer = content.filter((part) => typeof part === "string").join("");
  } else {
    throw providerError("AI 服務沒有回傳可讀的內容。");
  }

  answer = answer.trim().slice(0, LIMITS.answer);
  if (!answer) throw providerError("AI 服務沒有回傳可讀的內容。");
  return answer;
}
