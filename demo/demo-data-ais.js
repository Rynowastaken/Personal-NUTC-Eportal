// 100% fictional fixture dataset and offline API handler for the AIS Student Hub demo.

const PERIOD_TIMES = [
  ["1", "08:10~09:00"],
  ["2", "09:10~10:00"],
  ["3", "10:10~11:00"],
  ["4", "11:10~12:00"],
  ["5", "13:25~14:15"],
  ["6", "14:20~15:10"],
  ["7", "15:20~16:10"],
  ["8", "16:15~17:05"],
];

const COURSES = [
  {
    ccid: 3101,
    name: "資料庫系統",
    englishName: "Database Systems",
    teacher: "周致遠",
    credits: "3",
    hours: "3",
    required: "必",
    timeRoom: "週一 2–4 · 中正 3402",
    className: "資管三甲",
    outline: "介紹關聯式資料模型、ER 圖正規化設計、SQL 查詢最佳化，以及交易並行控制與復原機制。",
    objective: "培養學生獨立規劃正規化資料庫與撰寫高效 SQL 查詢的能力，並理解實務上索引設計對查詢效能的影響。",
    reference: "PostgreSQL 官方技術文件、Use The Index, Luke!（線上技術讀本）",
    books: [
      { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", publisher: "McGraw-Hill", year: "2020", edition: "7th Ed." },
    ],
    assessment: {
      midtermWarning: "實作佔比較重，第 7 週前須完成 ER Model 小專題。",
      items: [
        { label: "期中考", weight: "25%" },
        { label: "期末考", weight: "30%" },
        { label: "SQL 上機實作與小專題", weight: "30%" },
        { label: "課堂隨堂測驗", weight: "15%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "資料庫系統導論與架構", note: "環境建置：PostgreSQL" },
      { week: "第 2 週", topic: "實體關聯模型 (ER / EER Model)" },
      { week: "第 3 週", topic: "關聯式代數與表格正規化 (1NF–BCNF)" },
      { week: "第 4 週", topic: "SQL DDL 與基本查詢實作" },
      { week: "第 5 週", topic: "進階 JOIN、視觀表與視窗函數", note: "上機作業 #1" },
      { week: "第 6 週", topic: "索引結構：B+ Tree 與雜湊索引" },
      { week: "第 7 週", topic: "查詢執行計畫與效能調校 (EXPLAIN ANALYZE)" },
      { week: "第 8 週", topic: "期中評量檢討與資料庫專案分組報告" },
      { week: "第 9 週", topic: "交易管理與 ACID 特性" },
    ],
  },
  {
    ccid: 3102,
    name: "演算法導論",
    englishName: "Introduction to Algorithms",
    teacher: "林柏叡",
    credits: "3",
    hours: "3",
    required: "必",
    timeRoom: "週二 1–3 · 資訊 2305",
    className: "資管三甲",
    outline: "涵蓋漸近複雜度分析、分治法、動態規劃、貪婪演算法與圖論經典最短路徑問題。",
    objective: "建立分析演算法時間與空間複雜度的嚴謹思維，並能針對實務問題挑選合適資料結構求解。",
    books: [
      { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", publisher: "MIT Press", year: "2022", edition: "4th Ed." },
    ],
    assessment: {
      items: [
        { label: "期中筆試", weight: "30%" },
        { label: "期末筆試", weight: "30%" },
        { label: "程式解題作業（5 回）", weight: "25%" },
        { label: "課堂練習", weight: "15%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "漸近符號與遞迴式分析" },
      { week: "第 2 週", topic: "分治策略與快速排序、合併排序" },
      { week: "第 3 週", topic: "堆積與線性時間排序演算法" },
      { week: "第 4 週", topic: "動態規劃入門：背包問題與 LCS" },
      { week: "第 5 週", topic: "貪婪演算法與霍夫曼編碼" },
      { week: "第 6 週", topic: "圖的走訪：BFS / DFS 與拓撲排序" },
      { week: "第 7 週", topic: "最短路徑：Dijkstra 與 Bellman-Ford" },
    ],
  },
  {
    ccid: 3103,
    name: "網頁前端開發",
    englishName: "Modern Frontend Engineering",
    teacher: "許舒涵",
    credits: "3",
    hours: "3",
    required: "選",
    timeRoom: "週三 5–7 · 昌明 4501",
    className: "資管三甲",
    outline: "從語意化 HTML、現代 CSS Grid／Container Queries 到元件化互動設計、無障礙與前端效能調優。",
    objective: "能夠運用原生 Web API 與現代前端工具打造響應式、可維護且具備清晰資訊層次的網頁應用。",
    books: [
      { title: "Every Layout", author: "Heydon Pickering, Andy Bell", publisher: "Self-published", year: "2023", edition: "2nd Ed." },
    ],
    assessment: {
      items: [
        { label: "RWD 介面設計實作", weight: "30%" },
        { label: "期中互動展示專題", weight: "30%" },
        { label: "期末團隊專題", weight: "40%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "現代瀏覽器渲染管線與語意結構" },
      { week: "第 2 週", topic: "CSS Grid、Subgrid 與版面韻律" },
      { week: "第 3 週", topic: "無障礙操作 (WAI-ARIA) 與鍵盤焦點設計" },
      { week: "第 4 週", topic: "非同步請求、狀態快取與樂觀更新" },
      { week: "第 5 週", topic: "前端建置與元件模組化測試" },
    ],
  },
  {
    ccid: 3104,
    name: "資訊安全實務",
    englishName: "Applied Information Security",
    teacher: "陳冠宇",
    credits: "3",
    hours: "3",
    required: "必",
    timeRoom: "週一 6–8 · 中正 3504",
    className: "資管三甲",
    outline: "探討對稱／非對稱密碼學應用、TLS 安全傳輸、OWASP Top 10 網頁弱點與身份認證設計。",
    objective: "使學生具備在系統開發與維運階段辨識常見安全風險、制定防禦控制措施的能力。",
    books: [
      { title: "Cryptography Engineering", author: "Niels Ferguson, Bruce Schneier", publisher: "Wiley", year: "2015", edition: "2nd Ed." },
    ],
    assessment: {
      items: [
        { label: "靶機滲透與修復實驗", weight: "40%" },
        { label: "期中考", weight: "30%" },
        { label: "期末威脅建模報告", weight: "30%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "CIA 三要素與威脅建模概念" },
      { week: "第 2 週", topic: "雜湊函數、訊息鑑別碼與數位簽章" },
      { week: "第 3 週", topic: "TLS 1.3 與憑證信任鏈分析" },
      { week: "第 4 週", topic: "Injection、XSS 與 CSRF 防護實作" },
      { week: "第 5 週", topic: "OAuth 2.1 與安全 Session 管理" },
    ],
  },
  {
    ccid: 3105,
    name: "機器學習概論",
    englishName: "Introduction to Machine Learning",
    teacher: "張家豪",
    credits: "3",
    hours: "3",
    required: "選",
    timeRoom: "週四 2–4 · 資訊 2201",
    className: "資管三甲",
    outline: "講解監督式／非監督式學習、決策樹、隨機森林、梯度下降法及模型驗證與評估指標。",
    objective: "學會資料前處理、特徵工程、避免過擬合並針對不同問題挑選與評估機器學習模型。",
    books: [
      { title: "Hands-On Machine Learning", author: "Aurélien Géron", publisher: "O'Reilly", year: "2023", edition: "3rd Ed." },
    ],
    assessment: {
      items: [
        { label: "Jupyter Lab 資料分析作業", weight: "40%" },
        { label: "期中測驗", weight: "25%" },
        { label: "期末預測競賽專題", weight: "35%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "監督式學習流程與線性迴歸" },
      { week: "第 2 週", topic: "邏輯斯迴歸與分類混淆矩陣" },
      { week: "第 3 週", topic: "交叉驗證、正規化與超參數調校" },
      { week: "第 4 週", topic: "決策樹與梯度提升樹 (XGBoost / LightGBM)" },
    ],
  },
  {
    ccid: 3106,
    name: "專案管理與敏捷開發",
    englishName: "Agile Project Management",
    teacher: "王婉婷",
    credits: "2",
    hours: "2",
    required: "選",
    timeRoom: "週五 5–6 · 中正 3201",
    className: "資管三甲",
    outline: "結合 Scrum 敏捷開發儀式、使用者故事拆解、Git 團隊協作流程與軟體風險控管實戰。",
    objective: "能帶領 4–6 人團隊執行迭代式交付，掌握時程估算與團隊回顧改善循環。",
    books: [],
    assessment: {
      items: [
        { label: "Sprint 實作評量（三次）", weight: "60%" },
        { label: "期末專案回顧報告", weight: "40%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "傳統瀑布式與敏捷開發宣言" },
      { week: "第 2 週", topic: "Scrum 角色、Product Backlog 與估點" },
      { week: "第 3 週", topic: "Git Flow、Code Review 與 CI 自動化" },
    ],
  },
  {
    ccid: 3107,
    name: "職場專業英文",
    englishName: "Technical English Communication",
    teacher: "陳以安",
    credits: "2",
    hours: "2",
    required: "必",
    timeRoom: "週二 5–6 · 中正 3603",
    className: "資管三甲",
    outline: "訓練英文技術文件閱讀、架構簡報表達與跨團隊英文書信撰寫技巧。",
    objective: "提升閱讀技術規格與於英文會議中簡潔報告專案進度的自信。",
    books: [],
    assessment: {
      items: [
        { label: "技術簡報口說評量", weight: "40%" },
        { label: "英文技術摘要與書信", weight: "30%" },
        { label: "期末測驗", weight: "30%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "Reading Technical Specifications & RFCs" },
      { week: "第 2 週", topic: "Writing Concise Issue & PR Summaries" },
    ],
  },
  {
    ccid: 3108,
    name: "雲端架構實作",
    englishName: "Cloud Native Architecture",
    teacher: "吳宗翰",
    credits: "2",
    hours: "2",
    required: "選",
    timeRoom: "週三 2–3 · 資訊 2302",
    className: "資管三甲",
    outline: "容器化基礎、反向代理佈署、自動化監控指標與高可用服務設計實務。",
    objective: "理解現代雲端部署環境並能撰寫可重複部署的服務設定檔。",
    books: [],
    assessment: {
      items: [
        { label: "容器與服務佈署 Lab", weight: "60%" },
        { label: "期末架構設計報告", weight: "40%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "Linux Namespace、Cgroups 與容器映像設計" },
      { week: "第 2 週", topic: "健康檢查、自動重啟與反向代理" },
    ],
  },
  {
    ccid: 3109,
    name: "人機互動設計",
    englishName: "Human-Computer Interaction",
    teacher: "許舒涵",
    credits: "2",
    hours: "2",
    required: "選",
    timeRoom: "週四 6–7 · 昌明 4302",
    className: "資管三甲",
    outline: "以使用者為中心的研究方法、原型設計與可用性測試分析。",
    objective: "能透過訪談與量化測試評估介面易用性，改善操作流程摩擦。",
    books: [],
    assessment: {
      items: [
        { label: "可用性評估報告", weight: "50%" },
        { label: "高擬真原型展示", weight: "50%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "Norman 設計原則與認知負荷" },
      { week: "第 2 週", topic: "線框稿、原型設計與系統回饋" },
    ],
  },
  {
    ccid: 3110,
    name: "校務專題討論",
    englishName: "Department Seminar",
    teacher: "周致遠",
    credits: "1",
    hours: "2",
    required: "必",
    timeRoom: "週五 2–3 · 資訊 2101",
    className: "資管三甲",
    outline: "業師技術分享、畢業專題選題工作坊與學術研究倫理介紹。",
    objective: "協助大三同學定案畢業專題題目與組隊分工規劃。",
    books: [],
    assessment: {
      items: [
        { label: "講座心得紀錄", weight: "50%" },
        { label: "專題提案簡報", weight: "50%" },
      ],
    },
    weeks: [
      { week: "第 1 週", topic: "專題選題方向與文獻檢索入門" },
    ],
  },
];

// Schedule grid: slot index (0-7) x weekday index (0-4 = Mon-Fri)
const GRID = {
  "0-1": 3102, "1-1": 3102, "2-1": 3102, // Tue 1-3 Algorithms
  "1-0": 3101, "2-0": 3101, "3-0": 3101, // Mon 2-4 Database
  "5-0": 3104, "6-0": 3104, "7-0": 3104, // Mon 6-8 Security
  "4-1": 3107, "5-1": 3107,              // Tue 5-6 Technical English
  "1-2": 3108, "2-2": 3108,              // Wed 2-3 Cloud
  "4-2": 3103, "5-2": 3103, "6-2": 3103, // Wed 5-7 Frontend
  "1-3": 3105, "2-3": 3105, "3-3": 3105, // Thu 2-4 ML
  "5-3": 3109, "6-3": 3109,              // Thu 6-7 HCI
  "1-4": 3110, "2-4": 3110,              // Fri 2-3 Seminar
  "4-4": 3106, "5-4": 3106,              // Fri 5-6 Agile PM
};

const ANNOUNCEMENTS = [
  {
    id: 901,
    title: "【示範公告】114 學年度第 1 學期學業成績查詢暨成績複查申請作業時程",
    unit: "教務處註冊組",
    type: "教務公告, 重要",
    dateRange: "示範期間 · 全學期",
    bodyHtml:
      "<p>同學您好（此為展示用範例公告）：</p><p>本學期期中與期末評量成績陸續由授課教師登錄後，將同步更新至學生資訊系統與 Portal 成績頁面。</p><ul><li>成績疑義申請期限：成績公告日起 5 個工作日內。</li><li>跨院系選修學分認列請先洽詢所屬系辦公室確認課程標準分類。</li></ul><p>請留意公告附件中的範例時程說明表。</p>",
    attachments: [
      { name: "114-1_成績複查與選課日程表（示範）.pdf", url: "#demo-external" },
    ],
  },
  {
    id: 902,
    title: "【示範公告】圖書館期末延長開館暨 10F 研究小間預約規則說明",
    unit: "圖書館閱覽組",
    type: "館務公告",
    dateRange: "示範期間",
    bodyHtml:
      "<p>考前兩週期間，三民總館閱覽區延長開放時間至晚間 21:30，10 樓研究小間可透過 Portal 圖書館空間分頁預先登記使用時段。</p><p>提醒同學於預約起始時間 20 分鐘內完成報到領取鑰匙，若無法前往請提前於線上取消。</p>",
    attachments: [],
  },
  {
    id: 903,
    title: "【示範公告】資訊管理系三年級畢業專題提案審核分組名單公佈",
    unit: "資訊管理系辦",
    type: "系所通知",
    dateRange: "示範期間",
    bodyHtml:
      "<p>本學期資管系三年級專題分組與指導教師配對已完成初審，請各組組長登入系統確認組員名單及每週定期討論時段。</p>",
    attachments: [
      { name: "專題提案格式範本（示範）.docx", url: "#demo-external" },
    ],
  },
  {
    id: 904,
    title: "【示範公告】學生跨校／跨部選課線上申請及注意事項",
    unit: "教務處課務組",
    type: "選課須知",
    dateRange: "示範期間",
    bodyHtml: "<p>夜間部與日間部跨部選修名額開放登記中，請參閱系訂學分上限與衝堂規範。</p>",
    attachments: [],
  },
  {
    id: 905,
    title: "【示範公告】校園無線網路 eduroam 憑證更新提醒（示範資料）",
    unit: "圖書與資訊處網路組",
    type: "資安公告",
    dateRange: "示範期間",
    bodyHtml: "<p>校內 Wi-Fi 例行更換伺服器中繼憑證，建議手機與筆電連線時確認伺服器名稱網域無誤後重新信任即可。</p>",
    attachments: [],
  },
  {
    id: 906,
    title: "【示範公告】114 學年全校英文能力畢業門檻校外檢定獎勵補助開放登錄",
    unit: "語言中心",
    type: "獎補助",
    dateRange: "示範期間",
    bodyHtml: "<p>已通過校訂英文門檻且成績符合獎勵級距之同學，可備妥成績單影本於線上提出登錄申請（此為展示文字）。</p>",
    attachments: [],
  },
  {
    id: 907,
    title: "【示範公告】學生健康檢查報告領取與自主健康促進講座報名",
    unit: "學務處衛保組",
    type: "學務消息",
    dateRange: "示範期間",
    bodyHtml: "<p>新生及轉學生健檢紙本報告可至健康中心領取，線上摘要亦可直接查閱。</p>",
    attachments: [],
  },
  {
    id: 908,
    title: "【示範公告】學生會暨社團期末成果展場地申請協調會",
    unit: "課外活動指導組",
    type: "社團活動",
    dateRange: "示範期間",
    bodyHtml: "<p>各學術性與康樂性社團如有場地電力、音響借用需求，請派代表出席協調說明會。</p>",
    attachments: [],
  },
  {
    id: 909,
    title: "【示範公告】學雜費減免與弱勢助學金下一學期申請時程預告",
    unit: "學務處生輔組",
    type: "就學補助",
    dateRange: "示範期間",
    bodyHtml: "<p>符合資格同學請留意期末前之證明文件檢附清單與線上表單送出截止日期。</p>",
    attachments: [],
  },
  {
    id: 910,
    title: "【示範公告】校際程式設計交流賽暨 AI 應用工作坊開放報名",
    unit: "資訊與流通學院",
    type: "競賽活動",
    dateRange: "示範期間",
    bodyHtml: "<p>歡迎對演算法競賽與生成式 AI 系統設計有興趣的同學組隊報名，全程提供示範實作講義。</p>",
    attachments: [],
  },
];

function buildOverview() {
  const byId = new Map(COURSES.map((c) => [c.ccid, c]));
  const periods = PERIOD_TIMES.map(([slot, time], rowIdx) => ({
    slot,
    time,
    days: [0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
      const ccid = GRID[`${rowIdx}-${dayIdx}`];
      const course = ccid ? byId.get(ccid) : null;
      if (!course) return null;
      const room = course.timeRoom.split("·")[1]?.trim() || "";
      return { ccid: course.ccid, name: course.name, teacher: course.teacher, room };
    }),
  }));

  return {
    fetchedAt: new Date().toISOString(),
    termLabel: "114年(上)",
    profile: {
      name: "林語晨（示範）",
      studentId: "1111109901",
      division: "日間部四技",
      className: "資訊管理系三甲",
      englishName: "LIN, YU-CHEN (DEMO)",
      birthday: "2005-04-18",
      gender: "女",
      mobile: "0900-000-123",
      phone: "(04) 2219-0000",
      registeredAddress: "臺中市北區三民路三段 129 號（展示地址）",
      mailingAddress: "同戶籍地址（展示地址）",
      nationalIdMasked: "B2****8912",
    },
    schedule: {
      termLabel: "114年(上)",
      dayLabels: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
      periods,
      courses: COURSES.map(({ ccid, name, teacher, credits, hours, required, timeRoom, className }) => ({
        ccid, name, teacher, credits, hours, required, timeRoom, className,
      })),
    },
    progress: {
      program: "四年制資訊管理系（示範課程標準）",
      requirements: { requiredCredits: 96, electiveCredits: 32, crossDepartmentCredits: 8 },
      earned: {
        requiredCredits: 84,
        electiveCredits: 24,
        crossDepartmentCredits: 6,
        languageThreshold: "已通過（GEPT 中級）",
        departmentThreshold: "已通過（專業證照）",
        generalEducation: "博雅通識 12 / 12 學分",
      },
      expected: { requiredCredits: 96, electiveCredits: 32, crossDepartmentCredits: 8 },
      courses: [
        { year: "一年級", name: "程式設計（一）（二）", credits: "3", statusUp: "P", statusDown: "P" },
        { year: "一年級", name: "管理學", credits: "3", statusUp: "P", statusDown: "-" },
        { year: "一年級", name: "計算機概論", credits: "3", statusUp: "P", statusDown: "-" },
        { year: "一年級", name: "微積分", credits: "3", statusUp: "P", statusDown: "P" },
        { year: "二年級", name: "資料結構", credits: "3", statusUp: "P", statusDown: "-" },
        { year: "二年級", name: "物件導向程式設計", credits: "3", statusUp: "-", statusDown: "P" },
        { year: "二年級", name: "系統分析與設計", credits: "3", statusUp: "-", statusDown: "P" },
        { year: "二年級", name: "作業系統導論", credits: "3", statusUp: "T", statusDown: "-", note: "已辦理學分抵免" },
        { year: "三年級", name: "資料庫系統", credits: "3", statusUp: "?", statusDown: "-" },
        { year: "三年級", name: "演算法導論", credits: "3", statusUp: "?", statusDown: "-" },
        { year: "三年級", name: "資訊安全實務", credits: "3", statusUp: "?", statusDown: "-" },
        { year: "三年級", name: "校務專題討論", credits: "1", statusUp: "?", statusDown: "-" },
        { year: "四年級", name: "資訊管理畢業實務專題", credits: "3", statusUp: "N", statusDown: "N" },
      ],
    },
    absences: {
      termLabel: "114年(上)",
      summary: {
        absent: 0,
        late: 1,
        earlyLeave: 0,
        leaveTotal: 2,
        conduct: "86.5",
        leaveTypes: { 事假: 1, 公假: 1 },
      },
      items: [
        { course: "演算法導論", className: "資管三甲", teacher: "林柏叡", status: "遲到 · 第 1 節（範例）" },
        { course: "職場專業英文", className: "資管三甲", teacher: "陳以安", status: "公假 · 已核准 1 節（範例）" },
      ],
    },
    grades: {
      activeSemester: "1141",
      semesters: [
        {
          value: "1141",
          label: "114年上（期中模擬）",
          summary: { totalCredits: 18, earnedCredits: 18, average: 88.4, rank: "4 / 48" },
          rows: [
            { course: "資料庫系統", required: "必", group: "專業核心", className: "資管三甲", credits: "3", gradeInfo: { state: "pass", label: "92" } },
            { course: "演算法導論", required: "必", group: "專業核心", className: "資管三甲", credits: "3", gradeInfo: { state: "pass", label: "87" } },
            { course: "資訊安全實務", required: "必", group: "資安學群", className: "資管三甲", credits: "3", gradeInfo: { state: "pass", label: "89" } },
            { course: "網頁前端開發", required: "選", group: "系統設計", className: "資管三甲", credits: "3", gradeInfo: { state: "pass", label: "94" } },
            { course: "機器學習概論", required: "選", group: "資料科學", className: "資管三甲", credits: "3", gradeInfo: { state: "pass", label: "84" } },
            { course: "專案管理與敏捷開發", required: "選", group: "管理學群", className: "資管三甲", credits: "2", gradeInfo: { state: "pass", label: "88" } },
            { course: "校務專題討論", required: "必", group: "通識共同", className: "資管三甲", credits: "1", gradeInfo: { state: "pass", label: "90" } },
          ],
        },
        {
          value: "1132",
          label: "113年下",
          summary: { totalCredits: 21, earnedCredits: 21, average: 86.2, rank: "7 / 48" },
          rows: [
            { course: "物件導向程式設計", required: "必", group: "專業核心", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "91" } },
            { course: "系統分析與設計", required: "必", group: "系統設計", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "86" } },
            { course: "網路通訊協定", required: "必", group: "網路技術", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "83" } },
            { course: "企業資源規劃", required: "選", group: "管理學群", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "85" } },
            { course: "統計學與資料分析", required: "必", group: "共同必修", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "84" } },
            { course: "博雅通識：科技與社會", required: "必", group: "通識領域", className: "全校選修", credits: "2", gradeInfo: { state: "pass", label: "89" } },
          ],
        },
        {
          value: "1131",
          label: "113年上",
          summary: { totalCredits: 20, earnedCredits: 20, average: 84.5, rank: "11 / 48" },
          rows: [
            { course: "資料結構", required: "必", group: "專業核心", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "88" } },
            { course: "離散數學", required: "必", group: "基礎數理", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "81" } },
            { course: "會計學（二）", required: "必", group: "商管基礎", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "82" } },
            { course: "Linux 系統實務", required: "選", group: "網路技術", className: "資管二甲", credits: "3", gradeInfo: { state: "pass", label: "90" } },
          ],
        },
      ],
    },
    announcements: {
      total: ANNOUNCEMENTS.length,
      pages: 2,
      page: 1,
      items: ANNOUNCEMENTS.slice(0, 6).map(({ id, title, unit, type }) => ({ id, title, unit, type })),
    },
    errors: {},
  };
}

export function createAisMockHandler() {
  const overview = buildOverview();
  const byCcid = new Map(COURSES.map((c) => [c.ccid, c]));
  const byAnnId = new Map(ANNOUNCEMENTS.map((a) => [a.id, a]));

  return async (_method, url) => {
    const pathname = url.pathname;
    if (pathname === "/api/ais/overview") {
      return { status: 200, body: { ...overview, fetchedAt: new Date().toISOString() } };
    }
    if (pathname === "/api/ais/announcements") {
      const pageSize = 6;
      const pages = Math.max(1, Math.ceil(ANNOUNCEMENTS.length / pageSize));
      const page = Math.min(pages, Math.max(1, Number(url.searchParams.get("page")) || 1));
      const start = (page - 1) * pageSize;
      return {
        status: 200,
        body: {
          total: ANNOUNCEMENTS.length,
          pages,
          page,
          items: ANNOUNCEMENTS.slice(start, start + pageSize).map(({ id, title, unit, type }) => ({
            id,
            title,
            unit,
            type,
          })),
        },
      };
    }
    const annMatch = pathname.match(/^\/api\/ais\/announcements\/(\d+)$/);
    if (annMatch) {
      const hit = byAnnId.get(Number(annMatch[1]));
      return hit
        ? { status: 200, body: hit }
        : { status: 404, body: { error: "找不到示範公告。" } };
    }
    const courseMatch = pathname.match(/^\/api\/ais\/course\/(\d+)$/);
    if (courseMatch) {
      const hit = byCcid.get(Number(courseMatch[1]));
      return hit
        ? { status: 200, body: hit }
        : { status: 404, body: { error: "找不到示範課程詳情。" } };
    }
    return { status: 404, body: { error: "示範模式不支援此端點。" } };
  };
}
