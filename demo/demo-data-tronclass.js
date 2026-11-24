// 100% fictional fixture dataset and stateful offline API handler for the TronClass demo,
// including interactive practice exams, live grading, and simulated AI question tutor.

const dayMs = 86_400_000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * dayMs).toISOString().slice(0, 10);
const isoTime = (offsetDays, hour = 23, minute = 59) => {
  const dt = new Date(Date.now() + offsetDays * dayMs);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
};

function createCoursesData() {
  return [
    {
      id: 201,
      name: "資料庫系統",
      course_code: "MIS3012",
      credit: 3,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 11, name: "周致遠" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 78,
    },
    {
      id: 202,
      name: "演算法導論",
      course_code: "MIS3025",
      credit: 3,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 12, name: "林柏叡" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 64,
    },
    {
      id: 203,
      name: "網頁前端開發",
      course_code: "MIS3088",
      credit: 3,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 13, name: "許舒涵" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 85,
    },
    {
      id: 204,
      name: "資訊安全實務",
      course_code: "MIS3041",
      credit: 3,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 14, name: "陳冠宇" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 55,
    },
    {
      id: 205,
      name: "機器學習概論",
      course_code: "MIS3094",
      credit: 3,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 15, name: "張家豪" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 72,
    },
    {
      id: 206,
      name: "雲端架構實作",
      course_code: "MIS3108",
      credit: 2,
      start_date: isoDate(-42),
      end_date: isoDate(68),
      instructors: [{ id: 16, name: "吳宗翰" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 90,
    },
    {
      id: 190,
      name: "資料結構（上學期）",
      course_code: "MIS2014",
      credit: 3,
      start_date: isoDate(-240),
      end_date: isoDate(-95),
      instructors: [{ id: 12, name: "林柏叡" }],
      course_attributes: { teaching_class_name: "資管二甲" },
      study_completeness: 100,
    },
    {
      id: 299,
      name: "畢業專題實作（下學期預開）",
      course_code: "MIS4001",
      credit: 3,
      start_date: isoDate(40),
      end_date: isoDate(180),
      instructors: [{ id: 11, name: "周致遠" }],
      course_attributes: { teaching_class_name: "資管三甲" },
      study_completeness: 0,
    },
  ];
}

const PRACTICE_QUESTIONS = [
  {
    id: 5001,
    type: "single_selection",
    point: 25,
    description:
      "<p>在關聯式資料庫正規化設計中，若資料表 R 已經滿足<strong>第二正規化（2NF）</strong>，為進一步符合<strong>第三正規化（3NF）</strong>，必須消除下列哪一種相依關係？</p>",
    options: [
      { id: 1, sort: 1, content: "<p>重複群組或非原子屬性值（Repeating groups）</p>", is_answer: false },
      { id: 2, sort: 2, content: "<p>非主鍵欄位對候選鍵的<strong>遞移相依（Transitive Dependency）</strong></p>", is_answer: true },
      { id: 3, sort: 3, content: "<p>複合主鍵中對部分主鍵的部分功能相依（Partial Dependency）</p>", is_answer: false },
      { id: 4, sort: 4, content: "<p>不同資料表之間的外來鍵參照限制</p>", is_answer: false },
    ],
    answer_explanation: "3NF 要求每個非主鍵屬性都只能直接相依於候選鍵，不可透過其他非主鍵欄位產生遞移相依。",
    wrong_explanation: "提示：部分相依屬於 2NF 要消除的對象；消除「非主鍵之間互相決定」才是進入 3NF 的關鍵。",
  },
  {
    id: 5002,
    type: "single_selection",
    point: 25,
    description:
      "<p>假設資料表 <code>loans(patron_id, due_date, returned_at)</code> 建立了複合 B+ Tree 索引 <code>INDEX (patron_id, due_date)</code>。下列哪一個查詢條件<strong>最容易命中索引的最左前綴原則（Leftmost Prefix）</strong>並帶來最大效能提升？</p>",
    options: [
      { id: 11, sort: 1, content: "<p><code>WHERE patron_id = '1111109901' AND due_date &gt;= '2026-11-01'</code></p>", is_answer: true },
      { id: 12, sort: 2, content: "<p><code>WHERE due_date &gt;= '2026-11-01'</code>（未包含 <code>patron_id</code>）</p>", is_answer: false },
      { id: 13, sort: 3, content: "<p><code>WHERE returned_at IS NULL</code></p>", is_answer: false },
      { id: 14, sort: 4, content: "<p><code>WHERE UPPER(patron_id) LIKE '%9901'</code></p>", is_answer: false },
    ],
    answer_explanation: "複合 B+ Tree 索引依照定義欄位順序建立有序鍵，從最左欄 patron_id 起連續指定等值與範圍條件可直接進行索引範圍掃描。",
    wrong_explanation: "若跳過最左欄位 patron_id 直接只查詢 due_date，或對索引欄位套用函數與前置萬用字元，通常無法使用該 B+ Tree 索引快速定位。",
  },
  {
    id: 5003,
    type: "true_or_false",
    point: 25,
    description:
      "<p>是非題：在 SQL 中，<code>LEFT OUTER JOIN</code> 會保留左表所有符合條件或未配對的資料列，右表找不到對應紀錄時則補上 <code>NULL</code>。</p>",
    options: [
      { id: 21, sort: 1, content: "<p>正確（True）</p>", is_answer: true },
      { id: 22, sort: 2, content: "<p>錯誤（False）</p>", is_answer: false },
    ],
    answer_explanation: "正確。LEFT JOIN 以左表為主，保留左表每一筆紀錄，右表無對應列時欄位填入 NULL。",
    wrong_explanation: "INNER JOIN 才會過濾掉未配對資料列；LEFT OUTER JOIN 必定完整保留左表紀錄。",
  },
  {
    id: 5004,
    type: "multiple_selection",
    point: 25,
    description:
      "<p>多選題：關於資料庫交易的 <strong>ACID</strong> 四大特性，下列敘述哪些正確？</p>",
    options: [
      { id: 31, sort: 1, content: "<p><strong>Atomicity（原子性）</strong>：交易內的操作要嘛全部成功提交，要嘛全部回復撤銷</p>", is_answer: true },
      { id: 32, sort: 2, content: "<p><strong>Isolation（隔離性）</strong>：並發執行的交易彼此中間狀態不互相干擾</p>", is_answer: true },
      { id: 33, sort: 3, content: "<p><strong>Durability（持久性）</strong>：交易一旦 Commit 後，即使系統突發當機資料也不會遺失</p>", is_answer: true },
      { id: 34, sort: 4, content: "<p><strong>Consistency（一致性）</strong>：保證單機磁碟存取速度一定達到每秒百萬筆以上</p>", is_answer: false },
    ],
    answer_explanation: "Consistency 指的是交易前後資料庫都必須維持所有定義好的完整性限制（如外來鍵、餘額不為負等），與每秒吞吐速度無關。",
    wrong_explanation: "ACID 分別是原子性、一致性（完整性限制）、隔離性與持久性；第 4 個選項將一致性誤解為效能指標。",
  },
];

const QUIZ_REVIEW_QUESTIONS = [
  {
    id: 6001,
    type: "single_selection",
    point: 50,
    description: "<p>使用合併排序（Merge Sort）對長度為 <code>n</code> 的陣列進行排序時，在最壞情況下所需的時間複雜度為何？</p>",
    options: [
      { id: 1, sort: 1, content: "<p><code>O(n log n)</code></p>", is_answer: true },
      { id: 2, sort: 2, content: "<p><code>O(n^2)</code></p>", is_answer: false },
      { id: 3, sort: 3, content: "<p><code>O(n)</code></p>", is_answer: false },
    ],
    answer_explanation: "合併排序每次將序列對半分割，共遞迴 log n 層，每層線性合併耗時 O(n)，故最壞與平均皆為 O(n log n)。",
  },
  {
    id: 6002,
    type: "single_selection",
    point: 50,
    description: "<p>當所有邊的權重皆為非負數（w &gt;= 0）時，下列哪一種演算法適合用於計算單一來源點到其餘所有頂點的最短路徑？</p>",
    options: [
      { id: 11, sort: 1, content: "<p>Kruskal 演算法</p>", is_answer: false },
      { id: 12, sort: 2, content: "<p>Dijkstra 演算法</p>", is_answer: true },
      { id: 13, sort: 3, content: "<p>Prim 演算法</p>", is_answer: false },
    ],
    answer_explanation: "Dijkstra 演算法利用貪婪策略搭配最小優先佇列，在邊權重非負的圖上能正確算出單源最短路徑。",
  },
];

function buildAiResponse(questionObj, history) {
  const questionText = typeof questionObj === "string" ? questionObj : String(questionObj?.stem || "");
  if (Array.isArray(history) && history.length > 0) {
    const lastUserMsg = [...history].reverse().find((h) => h.role === "user")?.content || "";
    return [
      `針對你的追問：「${lastUserMsg.slice(0, 80)}」`,
      "",
      "實務檢查建議：",
      "1. 設計複合索引時，先列出最常出現的等值過濾欄（=），再擺範圍查詢欄（>= / BETWEEN），最後才放排序欄。",
      "2. 在查詢前執行 EXPLAIN (ANALYZE, BUFFERS)，確認執行計畫從 Seq Scan 轉成 Index Scan。",
      "",
      "（此為離線示範 AI 助教回覆；實際部署可接入自己的 LLM API。）",
    ].join("\n");
  }

  if (questionText.includes("正規化") || questionText.includes("3NF")) {
    const tableSpec = JSON.stringify({
      title: "資料庫正規化階層比較（1NF → 2NF → 3NF）",
      columns: ["階段", "必須消除的問題", "常見實例"],
      rows: [
        { label: "1NF", values: ["多值欄位、非原子值", "同一格存入多個電話號碼"] },
        { label: "2NF", values: ["對複合主鍵的部分相依", "(學號, 課號) -> 教師只依賴課號"] },
        { label: "3NF", values: ["非主鍵欄位的遞移相依", "學號 -> 系代碼 -> 系辦電話"] },
      ],
      note: "正解判斷：選項 2 正確描述 3NF 必須消除的遞移相依。",
    });
    return [
      "這題考的是第三正規化（3NF）與前兩階的差異。核心原則是：每個非主鍵欄位都只能直接相依於候選鍵（Eliminate Transitive Dependencies）。",
      "",
      "```table",
      tableSpec,
      "```",
      "",
      "若 A -> B 且 B -> C（其中 B 不是候選鍵），就會造成重複儲存與更新異常，因此選項 2 為正確答案。",
    ].join("\n");
  }

  if (questionText.includes("B+ Tree") || questionText.includes("索引")) {
    const tableSpec = JSON.stringify({
      title: "複合索引最左前綴原則判斷",
      columns: ["查詢條件寫法", "命中索引", "原因說明"],
      rows: [
        { label: "patron_id = ? AND due_date >= ?", values: ["可", "從最左欄 patron_id 起連續指定條件"] },
        { label: "due_date >= ?", values: ["否", "跳過最左欄，無法直接樹狀定位"] },
        { label: "UPPER(patron_id) LIKE '%9901'", values: ["否", "欄位套用函數與前置萬用字元失效"] },
      ],
      note: "建議選擇：選項 1。",
    });
    return [
      "B+ Tree 複合索引 (patron_id, due_date) 會先依 patron_id 排序，同一讀者內部再依 due_date 排序。",
      "",
      "```table",
      tableSpec,
      "```",
      "",
      "因此包含最左欄位 patron_id 的等值條件並接續 due_date 範圍篩選（選項 1）效率最佳。",
    ].join("\n");
  }

  if (questionText.includes("LEFT OUTER JOIN")) {
    return [
      "LEFT OUTER JOIN 的語意保證「左表所有紀錄都會保留，右表找不到對應紀錄時以 NULL 補齊」。",
      "",
      "常見對比：",
      "1. INNER JOIN：僅保留兩張表皆能配對成功的列。",
      "2. LEFT OUTER JOIN：完整保留左表，常用於查詢尚未還書或從未借閱的讀者。",
      "",
      "答案：正確（True）。",
    ].join("\n");
  }

  const acidTable = JSON.stringify({
    title: "交易四大特性（ACID）對照",
    columns: ["特性", "核心保證", "正誤"],
    rows: [
      { label: "Atomicity 原子性", values: ["全成功或全捲回", "正確"] },
      { label: "Consistency 一致性", values: ["維持商業完整性限制", "正確"] },
      { label: "Isolation 隔離性", values: ["並發交易互不干擾", "正確"] },
      { label: "Durability 持久性", values: ["Commit 後不因當機遺失", "正確"] },
    ],
    note: "選項 4 將 Consistency 誤解為每秒吞吐量指標，故錯誤。",
  });
  return [
    "交易（Transaction）依賴 ACID 四項保證維持資料正確性；其中 Consistency 指的是遵守主鍵、外來鍵與數值規則等資料限制，與每秒 IOPS 無關。",
    "",
    "```table",
    acidTable,
    "```",
    "",
    "正確選項為 1、2、3。",
  ].join("\n");
}

export function createTronclassMockHandler() {
  const courses = createCoursesData();
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  let aiConfig = {
    enabled: true,
    provider: "opencode-go",
    baseUrl: "https://opencode.ai/inference/go/openai/v1",
    model: "deepseek-v4.1-flash",
    hasKey: true,
  };

  let nextSubmissionId = 9100;

  const exams = new Map([
    [
      501,
      {
        id: 501,
        courseId: 201,
        title: "資料庫正規化與 SQL 索引練習測驗（支援問 AI）",
        module_id: 2012,
        sort: 1,
        start_time: isoTime(-5, 8, 0),
        end_time: isoTime(3, 23, 59),
        limit_time: 20,
        submit_times: 0,
        submitted_times: 0,
        subjects_count: PRACTICE_QUESTIONS.length,
        total_points: 100,
        is_practice_mode: true,
        enable_anti_cheat: false,
        is_fullscreen_mode: false,
        is_leaving_window_constrained: false,
        enable_invigilation: false,
        has_audio: false,
        check_submit_ip_consistency: false,
        has_temporary_submission: false,
        description:
          "<p>這份為<strong>練習模式</strong>測驗，可無限次練習並在作答介面點擊右上角「<strong>問 AI 這題</strong>」查看結構化講解與追問（示範環境採用內建離線模擬回答）。</p>",
        questions: PRACTICE_QUESTIONS,
        submissions: [],
        tempStorage: null,
      },
    ],
    [
      502,
      {
        id: 502,
        courseId: 202,
        title: "期前隨堂測驗：演算法複雜度與圖論（含檢討解答）",
        module_id: 2022,
        sort: 1,
        start_time: isoTime(-10, 9, 0),
        end_time: isoTime(6, 22, 0),
        limit_time: 15,
        submit_times: 3,
        submitted_times: 1,
        subjects_count: QUIZ_REVIEW_QUESTIONS.length,
        total_points: 100,
        is_practice_mode: true,
        enable_anti_cheat: false,
        is_fullscreen_mode: false,
        is_leaving_window_constrained: false,
        enable_invigilation: false,
        has_audio: false,
        check_submit_ip_consistency: false,
        has_temporary_submission: false,
        description: "<p>已收錄一筆示範交卷紀錄，可直接點選「查看上次作答」體驗完整檢討畫面。</p>",
        questions: QUIZ_REVIEW_QUESTIONS,
        submissions: [
          {
            id: 9001,
            submitted_at: isoTime(-2, 15, 20),
            submit_method_text: "主動交卷（示範紀錄）",
            score: 100,
            subjects_data: { subjects: QUIZ_REVIEW_QUESTIONS },
            submission_data: {
              score: 100,
              subjects: [
                { subject_id: 6001, answer_option_ids: [1] },
                { subject_id: 6002, answer_option_ids: [12] },
              ],
            },
            correct_answers_data: {
              correct_answers: [
                { subject_id: 6001, answer_option_ids: [1] },
                { subject_id: 6002, answer_option_ids: [12] },
              ],
            },
            correct_data: { 6001: true, 6002: true },
          },
        ],
        tempStorage: null,
      },
    ],
    [
      503,
      {
        id: 503,
        courseId: 204,
        title: "期中線上監考示範測驗（原站跳轉）",
        module_id: 2041,
        sort: 2,
        start_time: isoTime(-2, 10, 0),
        end_time: isoTime(5, 20, 0),
        limit_time: 50,
        submit_times: 1,
        submitted_times: 0,
        subjects_count: 20,
        total_points: 100,
        is_practice_mode: false,
        enable_anti_cheat: true,
        is_fullscreen_mode: true,
        is_leaving_window_constrained: true,
        enable_invigilation: true,
        has_audio: false,
        check_submit_ip_consistency: false,
        has_temporary_submission: false,
        description: "<p>此測驗模擬 TronClass 啟用監考（Invigilation）時的自動偵測與原站引導。</p>",
        questions: [],
        submissions: [],
        tempStorage: null,
      },
    ],
  ]);

  const activities = new Map([
    [
      7001,
      {
        id: 7001,
        courseId: 201,
        module_id: 2011,
        sort: 1,
        type: "material",
        title: "第 3 週講義：關聯代數與 BCNF 正規化設計",
        start_time: isoTime(-14, 9, 0),
        data: {
          description:
            "<h3>本單元學習目標</h3><p>理解函數相依（Functional Dependency）與無損分解條件，並能將實際訂單表格一步步拆分至 3NF／BCNF。</p><ul><li>掌握候選鍵推導步驟</li><li>識別部份相依與遞移相依</li></ul>",
        },
        uploads: [
          { id: 8101, reference_id: 8101, name: "Week03_Database_Normalization_Slides.pdf", size: 2_450_000, type: "attachment", allow_download: true },
          { id: 8102, reference_id: 8102, name: "Week03_ER_Practice_Schema.sql", size: 18_400, type: "attachment", allow_download: true },
        ],
      },
    ],
    [
      7002,
      {
        id: 7002,
        courseId: 201,
        module_id: 2011,
        sort: 2,
        type: "homework",
        title: "上機作業 #2：圖書館借還書 ER Model 與 SQL 實作",
        start_time: isoTime(-7, 9, 0),
        end_time: isoTime(2, 23, 59),
        data: {
          submit_times: 3,
          allow_late_submission: false,
          description:
            "<p>請設計圖書館館藏、讀者、預約與借閱關聯資料表，提供 <code>schema.sql</code> 與三組常見彙總查詢語法。</p><p><strong>繳交提醒：</strong>實際繳交表單會安全導回 TronClass 原站完成。</p>",
        },
        uploads: [],
        submissions: [],
      },
    ],
    [
      7003,
      {
        id: 7003,
        courseId: 203,
        module_id: 2031,
        sort: 1,
        type: "homework",
        title: "Lab 3：CSS Grid 與無障礙 Focus Ring 排版練習",
        start_time: isoTime(-12, 9, 0),
        end_time: isoTime(-1, 23, 59),
        data: {
          submit_times: 5,
          allow_late_submission: true,
          description: "<p>運用 CSS Grid 實作多欄卡片牆並維持鍵盤導覽聚焦對比。</p>",
        },
        uploads: [],
        submissions: [
          {
            id: 7701,
            is_draft: false,
            submitted_at: isoTime(-2, 21, 15),
            final_score: 94,
            comment: "版面層次清晰，桌機與手機斷點轉換自然，Focus 狀態符合標準。",
            content: "<p>已完成 Grid Responsive Dashboard Demo 並推送程式碼。</p>",
            uploads: [{ id: 8201, reference_id: 8201, name: "lab03-frontend-solution.zip" }],
          },
        ],
      },
    ],
    [
      7004,
      {
        id: 7004,
        courseId: 202,
        module_id: 2021,
        sort: 1,
        type: "material",
        title: "第 4 週講義：動態規劃與圖論最短路徑精要",
        start_time: isoTime(-10, 9, 0),
        data: {
          description: "<p>包含 0/1 背包問題狀態轉移表推導，以及 Dijkstra 鬆弛（Relaxation）步驟動畫解析講義。</p>",
        },
        uploads: [
          { id: 8301, reference_id: 8301, name: "Week04_DP_and_Shortest_Path.pdf", size: 3_120_000, type: "attachment", allow_download: true },
        ],
      },
    ],
    [
      7005,
      {
        id: 7005,
        courseId: 204,
        module_id: 2041,
        sort: 1,
        type: "material",
        title: "OWASP Top 10 安全防護實作檢核表",
        start_time: isoTime(-8, 13, 0),
        data: {
          description: "<p>整理 XSS、CSRF 與權限邊界檢查實務清單。</p>",
        },
        uploads: [],
      },
    ],
  ]);

  const modulesByCourse = {
    201: [
      { id: 2011, name: "第一單元：資料庫設計與 SQL 實作", sort: 1, is_hidden: false },
      { id: 2012, name: "第二單元：索引調校與線上複習測驗", sort: 2, is_hidden: false },
    ],
    202: [
      { id: 2021, name: "單元一：分治、動態規劃講義", sort: 1, is_hidden: false },
      { id: 2022, name: "單元二：隨堂測驗", sort: 2, is_hidden: false },
    ],
    203: [
      { id: 2031, name: "實作作業：現代 CSS 與無障礙介面", sort: 1, is_hidden: false },
    ],
    204: [
      { id: 2041, name: "弱點防禦與期中測驗", sort: 1, is_hidden: false },
    ],
  };

  const completenessByCourse = {
    201: new Map([[7001, "full"]]),
    202: new Map([[7004, "full"]]),
    203: new Map([[7003, "full"]]),
    204: new Map([[7005, "part"]]),
  };

  const gradeSubmission = (exam, sentSubjects) => {
    const chosenMap = new Map();
    for (const s of sentSubjects || []) {
      const ids = s.answer?.answer_option_ids || s.answer_option_ids || [];
      chosenMap.set(Number(s.subject_id), ids.map(Number));
    }
    const correctAnswers = [];
    const correctData = {};
    const submissionSubjects = [];
    let score = 0;

    for (const q of exam.questions) {
      const expectedIds = (q.options || []).filter((o) => o.is_answer).map((o) => o.id).sort((a, b) => a - b);
      const chosenIds = (chosenMap.get(q.id) || []).slice().sort((a, b) => a - b);
      const ok = expectedIds.length > 0 && expectedIds.join(",") === chosenIds.join(",");
      if (ok) score += Number(q.point) || 0;
      correctAnswers.push({ subject_id: q.id, answer_option_ids: expectedIds });
      correctData[q.id] = ok;
      submissionSubjects.push({ subject_id: q.id, answer_option_ids: chosenIds });
    }

    const sub = {
      id: ++nextSubmissionId,
      submitted_at: new Date().toISOString(),
      submit_method_text: "主動交卷（示範模擬計分）",
      score,
      subjects_data: { subjects: exam.questions },
      submission_data: { score, subjects: submissionSubjects },
      correct_answers_data: { correct_answers: correctAnswers },
      correct_data: correctData,
    };
    exam.submissions.push(sub);
    exam.submitted_times = exam.submissions.length;
    exam.has_temporary_submission = false;
    exam.tempStorage = null;
    return sub;
  };

  return async (method, url, body) => {
    const p = url.pathname;

    if (p === "/tronclass/me") {
      return { status: 200, body: { user: { id: 4201 } } };
    }
    if (p === "/api/ai/status") {
      return { status: 200, body: { enabled: aiConfig.enabled } };
    }
    if (p === "/api/ai/ask" && method === "POST") {
      if (!aiConfig.enabled) {
        return { status: 400, body: { code: "AI_NOT_CONFIGURED", error: "AI 助手已關閉。" } };
      }
      return { status: 200, body: { answer: buildAiResponse(body?.question, body?.history) } };
    }
    if (p === "/api/preferences/ai") {
      if (method === "GET") return { status: 200, body: { ai: aiConfig } };
      if (method === "POST" || method === "PUT") {
        aiConfig = {
          enabled: body?.enabled !== false,
          provider: body?.provider === "openai" ? "openai" : "opencode-go",
          baseUrl: String(body?.baseUrl || aiConfig.baseUrl),
          model: String(body?.model || aiConfig.model),
          hasKey: body?.clearKey ? false : Boolean(body?.apiKey || aiConfig.hasKey),
        };
        return { status: 200, body: { ai: aiConfig } };
      }
    }
    if (p === "/api/preferences") {
      return { status: 200, body: {} };
    }

    if (p === "/tronclass/api/my-courses") {
      return { status: 200, body: { courses } };
    }
    if (p === "/tronclass/api/user/recently-visited-courses") {
      return { status: 200, body: { visited_courses: [{ id: 201 }, { id: 202 }, { id: 203 }] } };
    }
    if (p === "/tronclass/api/todos") {
      const todos = [
        {
          id: 501,
          type: "exam",
          title: exams.get(501).title,
          course_id: 201,
          course_name: "資料庫系統",
          end_time: exams.get(501).end_time,
          is_student: true,
        },
        {
          id: 7002,
          type: "homework",
          title: activities.get(7002).title,
          course_id: 201,
          course_name: "資料庫系統",
          end_time: activities.get(7002).end_time,
          is_student: true,
        },
        {
          id: 502,
          type: "exam",
          title: exams.get(502).title,
          course_id: 202,
          course_name: "演算法導論",
          end_time: exams.get(502).end_time,
          is_student: true,
        },
      ];
      return { status: 200, body: { todo_list: todos } };
    }

    const courseMatch = p.match(/^\/tronclass\/api\/courses?\/(\d+)(?:\/(.*))?$/);
    if (courseMatch) {
      const cid = Number(courseMatch[1]);
      const sub = courseMatch[2] || "";
      const course = courseMap.get(cid);
      if (!course) return { status: 404, body: { error: "找不到示範課程。" } };
      if (!sub) return { status: 200, body: course };
      if (sub === "modules") return { status: 200, body: { modules: modulesByCourse[cid] || [] } };
      if (sub === "activities") {
        const list = [...activities.values()].filter((a) => a.courseId === cid).map((a) => ({ ...a, published: true }));
        return { status: 200, body: { activities: list } };
      }
      if (sub === "exams") {
        const list = [...exams.values()].filter((e) => e.courseId === cid).map((e) => ({ ...e, published: true }));
        return { status: 200, body: { exams: list } };
      }
      if (sub === "activity-reads-for-user") {
        const map = completenessByCourse[cid] || new Map();
        return {
          status: 200,
          body: { activity_reads: [...map.entries()].map(([activity_id, completeness]) => ({ activity_id, completeness })) },
        };
      }
      if (sub === "my-completeness") {
        const acts = [...activities.values()].filter((a) => a.courseId === cid);
        const exs = [...exams.values()].filter((e) => e.courseId === cid);
        const doneActs = [...(completenessByCourse[cid]?.values() || [])].filter((v) => v === "full").length;
        const doneEx = exs.filter((e) => e.submissions.length > 0).length;
        return {
          status: 200,
          body: {
            completed_result: {
              total_completed: doneActs + doneEx,
              total_activities: acts.length + exs.length,
            },
            last_activity: acts[0] ? { activity_id: acts[0].id } : null,
          },
        };
      }
      if (sub === "submitted-exams") {
        const examIds = [...exams.values()]
          .filter((e) => e.courseId === cid && e.submissions.length > 0)
          .map((e) => e.id);
        return { status: 200, body: { exam_ids: examIds } };
      }
      if (sub === "homework-scores") {
        const scores = [...activities.values()]
          .filter((a) => a.courseId === cid && a.submissions?.[0]?.final_score != null)
          .map((a) => ({ activity_id: a.id, final_score: a.submissions[0].final_score }));
        return { status: 200, body: { homework_activities: [], scores } };
      }
      if (sub === "exam-scores") {
        const examScores = [...exams.values()]
          .filter((e) => e.courseId === cid && e.submissions.length > 0)
          .map((e) => ({
            activity_id: e.id,
            score: Math.max(...e.submissions.map((s) => Number(s.score) || 0)),
          }));
        return { status: 200, body: { exam_scores: examScores } };
      }
    }

    const readMatch = p.match(/^\/tronclass\/api\/course\/activities-read\/(\d+)$/);
    if (readMatch && method === "POST") {
      return { status: 200, body: { ok: true } };
    }

    const hwSubMatch = p.match(/^\/tronclass\/api\/activities\/(\d+)\/students\/\d+\/submission_list$/);
    if (hwSubMatch) {
      const act = activities.get(Number(hwSubMatch[1]));
      return { status: 200, body: { list: act?.submissions || [] } };
    }

    const actMatch = p.match(/^\/tronclass\/api\/activities\/(\d+)$/);
    if (actMatch) {
      const act = activities.get(Number(actMatch[1]));
      return act ? { status: 200, body: act } : { status: 404, body: { error: "找不到活動。" } };
    }

    const qualMatch = p.match(/^\/tronclass\/api\/exam\/(\d+)\/check-exam-qualification$/);
    if (qualMatch) {
      const exam = exams.get(Number(qualMatch[1]));
      if (!exam) return { status: 404, body: { error: "找不到測驗。" } };
      return {
        status: 200,
        body: {
          is_closed: false,
          enable_invigilation: exam.enable_invigilation,
          has_audio: exam.has_audio,
          check_submit_ip_consistency: exam.check_submit_ip_consistency,
        },
      };
    }

    const saveMultiMatch = p.match(/^\/tronclass\/api\/exams\/submissions\/(\d+)\/multiple-subjects$/);
    if (saveMultiMatch && (method === "PUT" || method === "POST")) {
      for (const exam of exams.values()) {
        if (exam.tempStorage && exam.tempStorage.id === Number(saveMultiMatch[1])) {
          exam.tempStorage.submission_data = { subjects: body?.subjects_answers || [] };
        }
      }
      return { status: 200, body: { ok: true } };
    }

    const leftTimeMatch = p.match(/^\/tronclass\/api\/exams\/(\d+)\/left_time$/);
    if (leftTimeMatch) {
      for (const exam of exams.values()) {
        if (exam.tempStorage && exam.tempStorage.id === Number(leftTimeMatch[1])) {
          const elapsed = Math.floor((Date.now() - exam.tempStorage.startedAt) / 1000);
          const left = Math.max(60, (exam.limit_time || 20) * 60 - elapsed);
          exam.tempStorage.left_time = left;
          return { status: 200, body: { left_time: left } };
        }
      }
      return { status: 200, body: { left_time: 1200 } };
    }

    const examMatch = p.match(/^\/tronclass\/api\/exams\/(\d+)(?:\/(.*))?$/);
    if (examMatch) {
      const eid = Number(examMatch[1]);
      const sub = examMatch[2] || "";
      const exam = exams.get(eid);
      if (!exam) return { status: 404, body: { error: "找不到測驗。" } };
      if (!sub) return { status: 200, body: exam };
      if (sub === "distribute") {
        return {
          status: 200,
          body: {
            exam_paper_instance_id: eid * 100 + 1,
            subjects: exam.questions,
          },
        };
      }
      if (sub === "submissions/storage") {
        if (method === "POST") {
          if (!exam.tempStorage) {
            exam.tempStorage = {
              id: ++nextSubmissionId,
              instance_id: eid * 100 + 1,
              startedAt: Date.now(),
              left_time: (exam.limit_time || 20) * 60,
              submission_data: { subjects: body?.subjects || [] },
            };
            exam.has_temporary_submission = true;
          }
          return { status: 200, body: exam.tempStorage };
        }
        return { status: 200, body: exam.tempStorage || {} };
      }
      if (sub === "submissions") {
        if (method === "POST") {
          const created = gradeSubmission(exam, body?.subjects || []);
          return { status: 200, body: { id: created.id, score: created.score } };
        }
        return {
          status: 200,
          body: {
            submissions: exam.submissions.map(({ id, submitted_at, submit_method_text }) => ({
              id,
              submitted_at,
              submit_method_text,
            })),
          },
        };
      }
      const subDetailMatch = sub.match(/^submissions\/(\d+)$/);
      if (subDetailMatch) {
        const hit = exam.submissions.find((s) => s.id === Number(subDetailMatch[1]));
        return hit ? { status: 200, body: hit } : { status: 404, body: { error: "找不到交卷紀錄。" } };
      }
    }

    return { status: 404, body: { error: "示範模式未實作此端點。" } };
  };
}
