// 100% fictional fixture catalog, inline SVG cover art, loans, 10F carrel
// calendar/booking state, and database directory for the Library Hub demo.

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeBookCoverDataUri({ title, author, callNumber, bg, accent, badge }) {
  const shortTitle = escapeXml(String(title || "").slice(0, 18));
  const titleLine1 = escapeXml(String(title || "").slice(0, 9));
  const titleLine2 = escapeXml(String(title || "").slice(9, 18));
  const shortAuthor = escapeXml(String(author || "").split(/[，、]/)[0].slice(0, 14));
  const shortCall = escapeXml(String(callNumber || "").slice(0, 18));
  const tag = escapeXml(badge || "NUTC LIB");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340" width="240" height="340">`,
    `<defs>`,
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#110f15"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="240" height="340" rx="10" fill="url(#g)"/>`,
    `<rect x="0" y="0" width="14" height="340" fill="rgba(0,0,0,0.34)"/>`,
    `<circle cx="204" cy="54" r="74" fill="${accent}" fill-opacity="0.16"/>`,
    `<circle cx="44" cy="296" r="56" fill="${accent}" fill-opacity="0.1"/>`,
    `<rect x="28" y="26" width="84" height="22" rx="4" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-opacity="0.45"/>`,
    `<text x="70" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="700" fill="${accent}" letter-spacing="0.06em">${tag}</text>`,
    titleLine2
      ? `<text x="28" y="128" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="#f7f2f6">${titleLine1}</text><text x="28" y="158" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="#f7f2f6">${titleLine2}</text>`
      : `<text x="28" y="142" font-family="system-ui,sans-serif" font-size="21" font-weight="600" fill="#f7f2f6">${shortTitle}</text>`,
    `<line x1="28" y1="184" x2="112" y2="184" stroke="${accent}" stroke-width="2.5" stroke-opacity="0.8"/>`,
    `<text x="28" y="218" font-family="system-ui,sans-serif" font-size="13" fill="rgba(247,242,246,0.78)">${shortAuthor}</text>`,
    `<rect x="28" y="286" width="184" height="28" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>`,
    `<text x="38" y="304" font-family="monospace" font-size="11" fill="rgba(247,242,246,0.7)">${shortCall}</text>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PALETTES = [
  ["#2d1f2b", "#f0a8c8"],
  ["#1d2930", "#7cc7d1"],
  ["#27251d", "#e8b86d"],
  ["#241f30", "#c2a2ec"],
  ["#1d2b24", "#8fd8ad"],
  ["#30211d", "#eca28c"],
];

const SEED_BOOKS = [
  {
    title: "資料密集型應用系統設計",
    author: "Martin Kleppmann 著；張家維 譯",
    publisher: "歐萊禮",
    year: 2024,
    isbn: "9789865028817",
    callNumber: "312.93 8456 113",
    campus: "三民總館",
    scopes: ["ALL", "SM", "BOOK"],
    preset: "SMNEW",
    lang: ["CHI", "中文"],
    topic: ["ARCH", "系統架構與分散式設計"],
    sdg: ["SDG09", "SDG 9 工業與創新"],
    edition: "修訂二版",
    physicalDesc: "xxii, 614 頁 : 圖 ; 23 公分",
    series: "O'Reilly 技術經典系列",
    language: "繁體中文",
    subjects: ["分散式系統", "資料庫內部原理", "高可用架構", "串流處理"],
    summary:
      "本書深入解析現代資料系統背後的儲存引擎、複製協定、分片演算法與分散式共識（Consensus），將抽象論文理論與真實資料庫、訊息佇列實務設計緊密連結。\n\n全書分為資料系統基礎、分散式資料與衍生資料三大篇章，從 B+ Tree、LSM-Tree 的讀寫權衡一路談到批處理與即時事件串流架構，適合作為後端工程與資料工程的案頭經典。",
    summarySource: "三民網路書店書目摘要（示範資料）",
    authorBio: "Martin Kleppmann 為英國劍橋大學分散式系統研究員，曾參與多項大型資料基礎設施架構設計，擅長以清晰圖解剖析一致性和容錯議題。",
    notes: ["附中英文專有名詞對照索引", "館內提供教師指定參考複本"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館 (5F)", callNumber: "312.93 8456 113", itemType: "一般圖書", barcode: "D390112", status: "在架上" },
      { branch: "臺中科技大學 - 三民總館 (5F)", callNumber: "312.93 8456 113 c.2", itemType: "一般圖書", barcode: "D390113", status: "已借出" },
      { branch: "臺中科技大學 - 民生分館", callNumber: "312.93 8456 113 c.3", itemType: "一般圖書", barcode: "M210445", status: "在架上" },
    ],
  },
  {
    title: "安那其的黑色流星",
    author: "童育園 著",
    publisher: "蓋亞文化",
    year: 2025,
    isbn: "9786263841703",
    callNumber: "863.57 0006 114",
    campus: "三民總館",
    scopes: ["ALL", "SM", "BOOK"],
    preset: "SMNEW",
    lang: ["CHI", "中文"],
    topic: ["LIT", "當代華文小說"],
    sdg: ["SDG04", "SDG 4 優質教育"],
    edition: "初版",
    physicalDesc: "352 頁 ; 21 公分",
    series: "Novel 輕科幻選",
    language: "繁體中文",
    subjects: ["臺灣現代小說", "推理科幻", "都會寓言"],
    summary:
      "一顆墜落於海港工業區邊緣的黑鐵隕石，牽動三名年輕工程師與檔案管理員跨越十年的記憶拼圖。\n\n作者以細膩的都市觀察融合科幻懸疑筆法，在緊湊敘事裡探索個體意志與集體秩序之間的張力。",
    summarySource: "誠品線上書目介紹（示範資料）",
    authorBio: "童育園，臺灣新生代小說創作者，作品多關注城市空間記憶與當代青年處境，曾獲多項文學創作獎助。",
    notes: ["三民總館新進主題展選書"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館 (新進專區)", callNumber: "863.57 0006 114", itemType: "圖書", barcode: "D388152", status: "在架上" },
    ],
  },
  {
    title: "Clean Architecture：無瑕的軟體架構",
    author: "Robert C. Martin 著；陳韋廷 譯",
    publisher: "博碩文化",
    year: 2023,
    isbn: "9789864343577",
    callNumber: "312.92 8543 112",
    campus: "三民總館",
    scopes: ["ALL", "SM", "MS", "BOOK"],
    preset: "SMNEW",
    lang: ["CHI", "中文"],
    topic: ["ARCH", "系統架構與分散式設計"],
    sdg: ["SDG09", "SDG 9 工業與創新"],
    edition: "精裝修訂版",
    physicalDesc: "xxx, 398 頁 : 圖 ; 23 公分",
    series: "Clean Code 系列",
    language: "繁體中文",
    subjects: ["軟體架構", "SOLID 原則", "元件設計"],
    summary:
      "闡述如何透過清晰的邊界切分（Dependency Rule），讓商業核心邏輯獨立於資料庫、框架與 UI 呈現層之外，大幅降低系統長期維護成本。\n\n涵蓋程式設計典範演進、元件凝聚與耦合度量，並透過真實案例分析何時應刻意延後技術細節決策。",
    summarySource: "三民網路書店書目摘要（示範資料）",
    authorBio: "Robert C. Martin（Uncle Bob）為軟體工程領域資深講師與敏捷宣言共同發起人之一。",
    notes: ["資管系指定延伸閱讀"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館", callNumber: "312.92 8543 112", itemType: "一般圖書", barcode: "D341908", status: "已借出" },
      { branch: "臺中科技大學 - 民生分館", callNumber: "312.92 8543 112 c.2", itemType: "一般圖書", barcode: "M204118", status: "在架上" },
    ],
  },
  {
    title: "Designing Web APIs: Building APIs That Developers Love",
    author: "Brenda Jin, Saurabh Sahni, Amir Shevat",
    publisher: "O'Reilly Media",
    year: 2022,
    isbn: "9781492026921",
    callNumber: "QA76.76.A63 J56 2022",
    campus: "三民總館 · 電子書",
    scopes: ["ALL", "SM", "EBOOK"],
    preset: "SMNEW",
    lang: ["ENG", "英文"],
    topic: ["ARCH", "系統架構與分散式設計"],
    sdg: ["SDG09", "SDG 9 工業與創新"],
    edition: "1st Ed.",
    physicalDesc: "1 online resource (xx, 236 p.)",
    series: "O'Reilly Online Learning",
    language: "英文",
    subjects: ["Web API 設計", "REST", "OpenAPI", "開發者體驗"],
    summary:
      "Focused on practical API product thinking: choosing between REST, GraphQL, and webhooks, designing predictable pagination and error schemas, and establishing sustainable versioning workflows.",
    summarySource: "Google Books（示範資料）",
    authorBio: "Authors led developer platform teams at Slack and Twitter, shaping public API ecosystems used by millions of developers.",
    electronicUrl: "#demo-external",
    notes: ["校內網域／圖書館帳密驗證後可直接線上閱讀全文 PDF / ePub"],
    holdings: [
      { branch: "臺中科技大學 - 電子書平台", callNumber: "EBOOK QA76.76.A63", itemType: "電子書 (無複本限制)", barcode: "EB-88201", status: "可線上閱讀" },
    ],
  },
  {
    title: "臨床照護溝通與病人安全實務",
    author: "林慧芳 主編",
    publisher: "華杏出版",
    year: 2025,
    isbn: "9789861947129",
    callNumber: "419.7 8742 114",
    campus: "民生分館",
    scopes: ["ALL", "MS", "BOOK"],
    preset: "MSNEW",
    lang: ["CHI", "中文"],
    topic: ["HEALTH", "健康與護理照護"],
    sdg: ["SDG03", "SDG 3 健康與福祉"],
    edition: "二版",
    physicalDesc: "320 頁 : 部分彩圖 ; 26 公分",
    series: "現代護理臨床指引",
    language: "繁體中文",
    subjects: ["醫病溝通", "病人安全", "跨團隊照護"],
    summary:
      "結合團隊資源管理（TRM）模式與 ISBAR 交班標準化工具，解析臨床急重症與長期照護現場的風險辨識與溝通技巧。",
    summarySource: "圖書館編目摘要（示範資料）",
    authorBio: "林慧芳現任醫護教育專任教授，長期投入臨床模擬情境教學與照護品質改善研究。",
    notes: ["民生校區中護健康學院核心館藏"],
    holdings: [
      { branch: "臺中科技大學 - 民生分館 (3F)", callNumber: "419.7 8742 114", itemType: "一般圖書", barcode: "M309812", status: "在架上" },
      { branch: "臺中科技大學 - 民生分館 (3F)", callNumber: "419.7 8742 114 c.2", itemType: "一般圖書", barcode: "M309813", status: "在架上" },
    ],
  },
  {
    title: "UIUX 設計的思考與實踐：從線框稿到設計系統",
    author: "高橋祐介 著；蔡明潔 譯",
    publisher: "旗標科技",
    year: 2024,
    isbn: "9789863127987",
    callNumber: "312.97 8348 113",
    campus: "三民總館",
    scopes: ["ALL", "SM", "BOOK"],
    preset: "SMNEW",
    lang: ["CHI", "中文"],
    topic: ["DESIGN", "設計與使用者體驗"],
    sdg: ["SDG04", "SDG 4 優質教育"],
    edition: "初版",
    physicalDesc: "296 頁 : 彩圖 ; 23 公分",
    language: "繁體中文",
    subjects: ["使用者介面", "Design Tokens", "設計系統"],
    summary:
      "從排版比例、對比度與可及性檢核出發，教你建立可跨網頁與行動裝置共用的設計系統元件庫與語意色彩架構。",
    summarySource: "三民網路書店書目摘要（示範資料）",
    notes: ["附設計 Token 命名規範附錄"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館", callNumber: "312.97 8348 113", itemType: "一般圖書", barcode: "D377201", status: "在架上" },
    ],
  },
  {
    title: "Deep Learning with Python",
    author: "François Chollet",
    publisher: "Manning Publications",
    year: 2023,
    isbn: "9781617296864",
    callNumber: "Q325.7 .C46 2023",
    campus: "三民總館",
    scopes: ["ALL", "SM", "BOOK", "EBOOK"],
    preset: "",
    lang: ["ENG", "英文"],
    topic: ["AI", "人工智慧與機器學習"],
    sdg: ["SDG09", "SDG 9 工業與創新"],
    edition: "2nd Ed.",
    physicalDesc: "xxiv, 504 p. : ill. ; 24 cm",
    language: "英文",
    subjects: ["深度學習", "神經網路", "電腦視覺", "自然語言處理"],
    summary:
      "Written by the creator of Keras, offering an intuitive, code-first explanation of deep learning principles from gradient tape mechanics to Transformers.",
    summarySource: "Open Library（示範資料）",
    electronicUrl: "#demo-external",
    notes: ["含紙本與電子版雙載體"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館", callNumber: "Q325.7 .C46 2023", itemType: "西文圖書", barcode: "D355120", status: "在架上" },
      { branch: "臺中科技大學 - 電子書平台", callNumber: "EBOOK Q325.7", itemType: "電子書", barcode: "EB-77102", status: "可線上閱讀" },
    ],
  },
  {
    title: "日本語のシンタクスと意味（現代日語句法入門）",
    author: "寺村秀夫 著",
    publisher: "くろしお出版",
    year: 2021,
    isbn: "9784874248027",
    callNumber: "803.16 4425 110",
    campus: "語言中心",
    scopes: ["ALL", "SM", "LANG", "BOOK"],
    preset: "",
    lang: ["JPN", "日文"],
    topic: ["LANG", "語言學習與文法"],
    sdg: ["SDG04", "SDG 4 優質教育"],
    edition: "新版",
    physicalDesc: "340 頁 ; 21 公分",
    language: "日文",
    subjects: ["日語語言學", "格助詞", "句法結構"],
    summary:
      "系統梳理現代日本語的補語結構、動詞態貌與敘述語氣變化，是應日系與自學者進階剖析長難句的重要參考。",
    summarySource: "OpenBD（示範資料）",
    notes: ["語言中心自學參考書架可借"],
    holdings: [
      { branch: "臺中科技大學 - 語言中心", callNumber: "803.16 4425 110", itemType: "語言學習圖書", barcode: "L102344", status: "在架上" },
    ],
  },
  {
    title: "資訊安全治理與零信任架構實戰（視聽課程光碟）",
    author: "財團法人資安研訓院 製作",
    publisher: "資安學院出版",
    year: 2024,
    isbn: "9786269123405",
    callNumber: "AV 312.98 8341 113",
    campus: "三民總館",
    scopes: ["ALL", "SM", "AV"],
    preset: "",
    lang: ["CHI", "中文"],
    topic: ["SEC", "資訊安全與網路協定"],
    sdg: ["SDG09", "SDG 9 工業與創新"],
    edition: "教學視聽版",
    physicalDesc: "2 片視聽光碟（共 180 分鐘）+ 講義手冊",
    language: "繁體中文",
    subjects: ["零信任網路", "身份驗證", "企業資安防護"],
    summary:
      "以實務演練畫面說明 Zero Trust 架構中微隔離（Micro-segmentation）、持續裝置信任驗證與反向代理憑證控管的落地做法。",
    summarySource: "館藏編目說明（示範資料）",
    notes: ["請持學生證至三民總館 4F 視聽區櫃檯辦理借閱或館內觀賞"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館 (4F 視聽區)", callNumber: "AV 312.98 8341 113", itemType: "視聽影片", barcode: "AV90122", status: "在架上" },
    ],
  },
  {
    title: "永續商業模式與 ESG 企業報導實務",
    author: "黃怡嘉, 趙書銘 合著",
    publisher: "前程文化",
    year: 2025,
    isbn: "9789865774981",
    callNumber: "494.01 8334 114",
    campus: "三民總館",
    scopes: ["ALL", "SM", "BOOK"],
    preset: "SMNEW",
    lang: ["CHI", "中文"],
    topic: ["BIZ", "商業管理與永續發展"],
    sdg: ["SDG12", "SDG 12 責任消費與生產"],
    edition: "初版",
    physicalDesc: "412 頁 : 圖表 ; 23 公分",
    language: "繁體中文",
    subjects: ["ESG", "永續發展", "商業分析", "循環經濟"],
    summary:
      "拆解臺灣中小企業面臨碳盤查、供應鏈減碳與 GRI / ISSB 永續揭露準則的導入步驟與本土標竿個案。",
    summarySource: "三民網路書店書目摘要（示範資料）",
    notes: ["附企業永續報告書檢核表"],
    holdings: [
      { branch: "臺中科技大學 - 三民總館", callNumber: "494.01 8334 114", itemType: "一般圖書", barcode: "D391002", status: "在架上" },
    ],
  },
];

const TOPIC_LIBRARY = [
  ["ARCH", "系統架構與分散式設計", ["分散式系統", "資料庫原理", "微服務架構"]],
  ["AI", "人工智慧與機器學習", ["機器學習", "深度學習", "自然語言處理"]],
  ["SEC", "資訊安全與網路協定", ["資訊安全", "密碼學", "弱點防護"]],
  ["DESIGN", "設計與使用者體驗", ["介面設計", "互動原型", "色彩學"]],
  ["BIZ", "商業管理與永續發展", ["財務管理", "電子商務", "ESG 治理"]],
  ["HEALTH", "健康與護理照護", ["長期照護", "健康促進", "臨床溝通"]],
  ["LANG", "語言學習與文法", ["學術寫作", "職場英文", "日語句法"]],
  ["LIT", "當代華文小說", ["現代散文", "都市小說", "文化觀察"]],
];

function generateDemoCatalog() {
  const list = SEED_BOOKS.map((book, index) => {
    const pal = PALETTES[index % PALETTES.length];
    const id = 10001 + index;
    const avail = book.holdings.filter((h) => /在架|可/.test(h.status)).length;
    return {
      ...book,
      id,
      detailPath: `/demo/bib/${id}`,
      officialUrl: "#demo-external",
      publisherYear: `${book.publisher}，${book.year}`,
      availableCount: avail,
      totalCount: book.holdings.length,
      holdsCount: avail === 0 ? 2 : 0,
      holdable: true,
      coverProxyUrl: makeBookCoverDataUri({
        title: book.title,
        author: book.author,
        callNumber: book.callNumber,
        bg: pal[0],
        accent: pal[1],
        badge: book.scopes.includes("EBOOK") ? "E-BOOK" : book.scopes.includes("AV") ? "MEDIA" : book.campus.slice(0, 4),
      }),
    };
  });

  const extraTitles = [
    ["高效能網頁與瀏覽器架構", "林致誠 著", "碁峰資訊", 2024, "0", "MS"],
    ["現代 JavaScript 非同步設計模式", "張宇軒 著", "博碩文化", 2023, "0", "SM"],
    ["SQL 查詢調校與索引設計手冊", "吳俊宏 著", "松崗文化", 2025, "0", "SM"],
    ["Statistics for Business & Economics", "Anderson, Sweeney", "Cengage", 2023, "4", "SM"],
    ["健康體適能與運動生理學導論", "李佳樺 主編", "永大書局", 2024, "5", "MS"],
    ["設計心理學：以人為本的設計思考", "唐納·諾曼 著", "遠流出版", 2022, "3", "SM"],
    ["TOEIC 商業實戰聽讀解析", "Sarah Jenkins", "敦煌書局", 2024, "6", "LANG"],
    ["微服務監控與可觀測性實務", "陳建霖 著", "旗標科技", 2025, "0", "SM"],
    ["Generative AI in Education", "Elena Vance", "Springer", 2024, "1", "EBOOK"],
    ["供應鏈韌性與智慧物流管理", "王柏鈞 著", "五南圖書", 2023, "4", "SM"],
    ["網頁滲透測試與紅藍隊防禦演練", "黃冠博 著", "深智數位", 2024, "2", "SM"],
    ["日本語能力試驗 N2 文法總複習", "山田晃子 著", "大新書局", 2023, "6", "LANG"],
    ["城市光影：臺灣戰後建築手記", "梁心怡 著", "麥田出版", 2024, "7", "SM"],
    ["React 與前端狀態管理實戰", "賴俊宇 著", "碁峰資訊", 2025, "0", "EBOOK"],
    ["高齡化社會長照政策與跨專業合作", "周婉蓉 著", "巨流圖書", 2024, "5", "MS"],
    ["The Pragmatic Programmer", "David Thomas, Andrew Hunt", "Addison-Wesley", 2020, "0", "SM"],
    ["資料視覺化敘事：圖表設計的邏輯", "林詠晴 著", "原點出版", 2023, "3", "SM"],
    ["分散式快取 Redis 原理與營運指南", "郭家誠 著", "深智數位", 2024, "0", "SM"],
    ["企業數位轉型與 AI 導入個案選輯", "臺中科技大學商學院", "華泰文化", 2025, "4", "SM"],
    ["醫療資訊系統與 FHIR 資料交換標準", "許文豪 著", "合記圖書", 2024, "5", "MS"],
    ["Rust 系統程式設計與記憶體安全", "陳冠宇 著", "博碩文化", 2025, "0", "EBOOK"],
    ["演算法圖解：從陣列到圖論（影像課程）", "數位教材中心", "校內出版", 2024, "0", "AV"],
    ["金融科技與開放銀行 API 規範", "蕭銘賢 著", "東華書局", 2023, "4", "SM"],
    ["簡約排版與字體排印設計", "佐藤健一 著", "臉譜出版", 2022, "3", "SM"],
    ["Linux 核心與容器虛擬化原理", "楊宗儒 著", "深智數位", 2024, "2", "SM"],
    ["商業英語簡報與談判實務", "David Ross", "Oxford Press", 2023, "6", "LANG"],
    ["臺灣地方創生與社區共好觀察", "洪敏慧 著", "春山出版", 2024, "7", "MS"],
    ["Graph Neural Networks Foundations", "Kenji Takahashi", "MIT Press", 2024, "1", "EBOOK"],
    ["會計資訊系統與內部控制實務", "張佩珊 著", "智勝文化", 2023, "4", "SM"],
    ["大型語言模型微調與檢索增強 (RAG)", "周致遠, 陳冠宇", "旗標科技", 2025, "0", "SM"],
    ["臨床藥物學重點速查", "柯麗萍 編著", "華杏出版", 2024, "5", "MS"],
    ["TypeScript 嚴格型別系統設計模式", "劉品妤 著", "博碩文化", 2025, "0", "SM"],
    ["創意寫作與非虛構敘事工作坊", "葉心嵐 著", "聯經出版", 2023, "7", "SM"],
    ["Zero Knowledge Proofs Intro", "Claire Moreau", "Cambridge", 2024, "2", "EBOOK"],
    ["行動應用開發：Android Jetpack Compose", "許舒涵 著", "碁峰資訊", 2025, "0", "SM"],
    ["消費者行為與社群資料分析", "蔡宛廷 著", "雙葉書廊", 2024, "4", "SM"],
    ["臨床英文護理溝通會話", "Grace Miller", "Elsevier", 2022, "5", "MS"],
    ["數位音效設計與影片配樂工作坊（光碟）", "多媒體設計系", "校內出版", 2024, "3", "AV"],
  ];

  extraTitles.forEach(([title, author, publisher, year, topicIdxStr, kindTag], i) => {
    const idx = list.length;
    const topicDef = TOPIC_LIBRARY[Number(topicIdxStr) % TOPIC_LIBRARY.length];
    const pal = PALETTES[idx % PALETTES.length];
    const isEnglish = /^[A-Za-z]/.test(title);
    const isJapanese = /日本語|くろしお/.test(title);
    const lang = isJapanese ? ["JPN", "日文"] : isEnglish ? ["ENG", "英文"] : ["CHI", "中文"];
    const campus =
      kindTag === "MS"
        ? "民生分館"
        : kindTag === "LANG"
          ? "語言中心"
          : kindTag === "EBOOK"
            ? "三民總館 · 電子書"
            : "三民總館";
    const scopes = ["ALL"];
    if (kindTag === "MS") scopes.push("MS", "BOOK");
    else if (kindTag === "LANG") scopes.push("SM", "LANG", "BOOK");
    else if (kindTag === "EBOOK") scopes.push("SM", "EBOOK");
    else if (kindTag === "AV") scopes.push("SM", "AV");
    else scopes.push("SM", "BOOK");

    const callNumber = `${312 + i}.${10 + (i * 7) % 89} ${8100 + i * 13} ${year - 1911}`;
    const isbn = `978626${String(3100000 + idx * 173).slice(0, 7)}`;
    const id = 10001 + idx;
    const inStock = idx % 5 !== 4;
    const holdings = [
      {
        branch: `臺中科技大學 - ${campus.split(" ·")[0]}`,
        callNumber,
        itemType: kindTag === "EBOOK" ? "電子書" : kindTag === "AV" ? "視聽資料" : "一般圖書",
        barcode: `${kindTag === "MS" ? "M" : "D"}${370000 + idx * 11}`,
        status: kindTag === "EBOOK" ? "可線上閱讀" : inStock ? "在架上" : "已借出",
      },
    ];
    if (idx % 3 === 0 && kindTag !== "EBOOK") {
      holdings.push({
        branch: "臺中科技大學 - 民生分館",
        callNumber: `${callNumber} c.2`,
        itemType: "一般圖書",
        barcode: `M${210000 + idx * 9}`,
        status: "在架上",
      });
    }
    const availCount = holdings.filter((h) => /在架|可/.test(h.status)).length;
    const sdgPool = [
      ["SDG04", "SDG 4 優質教育"],
      ["SDG09", "SDG 9 工業與創新"],
      ["SDG03", "SDG 3 健康與福祉"],
      ["SDG12", "SDG 12 責任消費與生產"],
    ];
    const sdg = sdgPool[idx % sdgPool.length];

    list.push({
      id,
      detailPath: `/demo/bib/${id}`,
      officialUrl: "#demo-external",
      electronicUrl: kindTag === "EBOOK" ? "#demo-external" : "",
      title,
      author,
      publisher,
      year,
      publisherYear: `${publisher}，${year}`,
      isbn,
      callNumber,
      campus,
      scopes,
      preset: year >= 2025 ? (kindTag === "MS" ? "MSNEW" : "SMNEW") : "",
      lang,
      topic: [topicDef[0], topicDef[1]],
      sdg,
      edition: year >= 2024 ? "二版" : "初版",
      physicalDesc: kindTag === "EBOOK" ? "1 online resource (PDF / ePub)" : `${260 + (idx % 9) * 24} 頁 : 圖表 ; 23 公分`,
      series: idx % 2 === 0 ? "圖書館推薦精選館藏" : "",
      language: lang[1],
      subjects: topicDef[2],
      summary: `《${title}》聚焦「${topicDef[1]}」核心知識與實務案例，從基礎理論架構出發，逐步引導讀者完成實作演練與專案整合。\n\n本條目為公開展示用範例書目資料（ISBN ${isbn}），可用於測試分類篩選、書目詳情版面與複本館藏顯示。`,
      summarySource: "圖書館示範書目資料庫",
      authorBio: `${author.split(" ")[0]} 長期投入相關教學與技術寫作，出版多部專書與研討論文（示範傳記）。`,
      notes: [`館藏分類號：${callNumber}`, "展示資料僅供介面功能預覽"],
      holdings,
      availableCount: availCount,
      totalCount: holdings.length,
      holdsCount: availCount === 0 ? 1 : 0,
      holdable: true,
      coverProxyUrl: makeBookCoverDataUri({
        title,
        author,
        callNumber,
        bg: pal[0],
        accent: pal[1],
        badge: kindTag === "EBOOK" ? "E-BOOK" : kindTag === "AV" ? "MEDIA" : campus.slice(0, 4),
      }),
    });
  });

  return list;
}

const DEMO_DATABASES = [
  { name: "IEEE Xplore Digital Library", college: "資訊與流通學院", language: "西文", accessType: "校內/VPN", expiry: "2027-12-31", description: "收錄電機、電子、資訊科學與工程技術期刊、會議論文與標準。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "ACM Digital Library", college: "資訊與流通學院", language: "西文", accessType: "校內/VPN", expiry: "2027-12-31", description: "計算機科學全域權威學會出版之期刊、會議集與技術電子報。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "Airiti Library 華藝線上圖書館", college: "全校", language: "中文", accessType: "校內/SSO", expiry: "2027-06-30", description: "臺灣核心中文學術期刊、博碩士論文與會議論文全文檢索資料庫。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "Turnitin Feedback Studio 論文原創性比對系統", college: "全校", language: "西文", accessType: "帳密申請", expiry: "2027-08-31", description: "論文比對系統，支援中英文學術論文與專題報告相似度檢測。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "FastMatch 中文論文比對系統", college: "全校", language: "中文", accessType: "校內/SSO", expiry: "2027-07-31", description: "專為繁體中文論文、學位報告打造的全文檢索與文獻相似度比對服務。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "ScienceDirect (Elsevier)", college: "全校", language: "西文", accessType: "校內/VPN", expiry: "2027-12-31", description: "收錄科學、工程、商業與健康護理領域大量國際同儕審查期刊。", url: "#demo-external", guideUrl: "#demo-external" },
  { name: "UDN 數位閱讀電子書庫", college: "全校", language: "中文", accessType: "SSO免再登", expiry: "2027-09-30", description: "中文暢銷非文學、資訊工具與設計美學電子書借閱平台。", url: "#demo-external" },
  { name: "ProQuest ABI/INFORM Collection", college: "商學院", language: "西文", accessType: "校內/VPN", expiry: "2027-12-31", description: "商管、經濟、財務金融與企業經營案例全文資料庫。", url: "#demo-external" },
  { name: "TEJ 台灣經濟新報資料庫", college: "商學院", language: "中文", accessType: "校園限流", expiry: "2027-11-30", description: "臺灣上市櫃財報、股價與總體經濟實證金融數據庫。", url: "#demo-external" },
  { name: "Cinahl Ultimate 護理與健康資料庫", college: "中護健康學院", language: "西文", accessType: "校內/VPN", expiry: "2027-12-31", description: "實證護理、復健與臨床照護研究核心索引及全文平台。", url: "#demo-external" },
  { name: "Cinii Research 日文學術情報檢索", college: "語文學院", language: "日文", accessType: "開放/校內", expiry: "常設", description: "日本國立情報學研究所建置之日語學術論文與書籍綜合目錄。", url: "#demo-external" },
  { name: "Behance / Pantone Color & Design Hub（示範資源）", college: "設計學院", language: "西文", accessType: "校內/VPN", expiry: "2027-06-30", description: "視覺傳達、互動設計案例作品集與色彩系統參考資料。", url: "#demo-external" },
];

function computeFacets(items) {
  const tally = (extractor) => {
    const map = new Map();
    for (const item of items) {
      const pair = extractor(item);
      if (!pair) continue;
      const [key, qf, label] = pair;
      if (!map.has(qf)) map.set(qf, { key, qf, label, count: 0 });
      map.get(qf).count += 1;
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  };

  return [
    {
      key: "TOPIC",
      label: "主題標籤",
      items: tally((b) => [`TOPIC_${b.topic[0]}`, `TOPIC\t主題\t${b.topic[0]}\t${b.topic[1]}`, b.topic[1]]),
    },
    {
      key: "LANGUAGE",
      label: "語言",
      items: tally((b) => [`LANG_${b.lang[0]}`, `LANGUAGE\t語言\t${b.lang[0]}\t${b.lang[1]}`, b.lang[1]]),
    },
    {
      key: "PUBYEAR",
      label: "出版年",
      items: tally((b) => [`YEAR_${b.year}`, `PUBYEAR\t出版年\t${b.year}\t${b.year}`, `${b.year} 年`]),
    },
    {
      key: "SDGS",
      label: "SDGs 永續",
      items: tally((b) => [`SDG_${b.sdg[0]}`, `SDGS\t永續發展目標\t${b.sdg[0]}\t${b.sdg[1]}`, b.sdg[1]]),
    },
  ].filter((group) => group.items.length > 0);
}

function addDaysIso(isoStr, days) {
  const dt = new Date(`${isoStr}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function createLibraryMockHandler() {
  const catalog = generateDemoCatalog();
  const byId = new Map(catalog.map((b) => [b.id, b]));
  const dayMs = 86_400_000;
  const isoDay = (offset) => new Date(Date.now() + offset * dayMs).toISOString().slice(0, 10);

  let nextCarrelSeq = 920;

  const account = {
    checkouts: [
      {
        id: "loan-101",
        title: "資料密集型應用系統設計",
        callNumber: "312.93 8456 113 c.2",
        renewals: "已續借 0 次（可續借）",
        dueDate: isoDay(5),
        renewable: true,
        renewalCount: 0,
      },
      {
        id: "loan-102",
        title: "Clean Architecture：無瑕的軟體架構",
        callNumber: "312.92 8543 112",
        renewals: "已續借 1 次（可續借）",
        dueDate: isoDay(9),
        renewable: true,
        renewalCount: 1,
      },
      {
        id: "loan-103",
        title: "The Pragmatic Programmer",
        callNumber: "312.90 8312 109",
        renewals: "預約中圖書（不可續借）",
        dueDate: isoDay(2),
        renewable: false,
        renewalCount: 0,
      },
    ],
    holds: [
      {
        title: "大型語言模型微調與檢索增強 (RAG)",
        pickupLibrary: "三民總館取書櫃檯",
        expiresAt: `保留至 ${isoDay(4)}`,
        status: "可取書（示範）",
      },
    ],
    fines: [],
    history: [
      { title: "Every Layout: Relearn CSS Layout", author: "Heydon Pickering", checkoutDate: isoDay(-35) },
      { title: "HTTP/2 與現代網路效能", author: "陳致宇 著", checkoutDate: isoDay(-62) },
      { title: "設計的心理學", author: "Donald Norman", checkoutDate: isoDay(-90) },
    ],
  };

  let reservations = [
    {
      targetId: "carrel-901",
      roomNumber: "3",
      room: "研究小間 10F-3",
      dateStart: isoDay(2),
      dateEnd: isoDay(2),
      dateRange: `${isoDay(2)} ~ ${isoDay(2)}`,
      timePeriod: "13時-17時",
      status: "已預約（示範）",
      canCancel: true,
    },
  ];

  const getOverview = () => ({
    fetchedAt: new Date().toISOString(),
    status: "正常（示範）",
    patron: { maskedId: "S1111****1" },
    summary: {
      checkoutsCount: account.checkouts.length,
      holdsCount: account.holds.length,
      finesTotal: "NT$0",
      activeCarrelsCount: reservations.length,
    },
    account,
    carrels: {
      formDefaults: {
        role: "學生",
        department: "資管三甲",
        phone: "0900-000-123",
        email: "demo.student@example.edu.tw",
        altEmail: "backup.demo@example.edu.tw",
        periods: [
          { value: "1", label: "整天" },
          { value: "2", label: "9時-13時" },
          { value: "3", label: "13時-17時" },
          { value: "4", label: "17時-21時" },
        ],
        rooms: ["1", "2", "3", "4", "5", "6", "7"].map((v) => ({
          value: v,
          label: `研究小間10F-${v}`,
        })),
        rules: [
          "研究小間每次至多可預約 4 小時時段（示範規則）。",
          "預約起始 20 分鐘內需於 10F 櫃檯報到領取門禁感應卡。",
        ],
      },
      reservations,
    },
    downloads: [
      { title: "EndNote 21 校園授權版（Windows 安裝程式 · 示範）", platform: "Windows", downloadPath: "#demo-download" },
      { title: "EndNote 21 校園授權版（macOS 安裝映像檔 · 示範）", platform: "macOS", downloadPath: "#demo-download" },
    ],
    sectionErrors: {},
  });

  const DEMO_FAV_STORAGE_KEY = "nutc-library-demo-favorites-v1";
  const toFavSnapshot = (b) => ({
    id: String(b.id),
    title: b.title || "",
    author: b.author || "",
    publisherYear: b.publisherYear || "",
    isbn: b.isbn || "",
    callNumber: b.callNumber || "",
    campus: b.campus || "",
    detailPath: b.detailPath || "",
    officialUrl: b.officialUrl || "",
    coverProxyUrl: b.coverProxyUrl || "",
    savedAt: b.savedAt || new Date().toISOString(),
  });
  let favorites = (() => {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(DEMO_FAV_STORAGE_KEY) || "null");
      if (Array.isArray(saved)) return saved;
    } catch {}
    return catalog.slice(0, 2).map(toFavSnapshot);
  })();
  const saveDemoFavorites = (next) => {
    favorites = next;
    try {
      globalThis.localStorage?.setItem(DEMO_FAV_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const buildCalendarMonth = (year, month) => {
    const totalDays = new Date(year, month, 0).getDate();
    const todayIso = isoDay(0);
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let baseRooms;
      if (dateKey < todayIso) {
        baseRooms = [];
      } else {
        baseRooms = ["1", "2", "3", "4", "5", "6", "7"].filter((room) => {
          const seed = (year * 31 + month * 17 + d * 7 + Number(room) * 5) % 9;
          return seed !== 0; // Keep most rooms free while showing realistic busy slots
        });
        if (d % 11 === 0) baseRooms = []; // Show an occasional fully booked day in legend
      }
      const bookedSet = new Set(
        reservations
          .filter((r) => dateKey >= r.dateStart && dateKey <= r.dateEnd)
          .map((r) => String(r.roomNumber)),
      );
      const availableRooms = baseRooms.filter((r) => !bookedSet.has(r));
      days.push({ day: d, dateKey, availableRooms });
    }
    return { year, month, days };
  };

  return async (method, url, body) => {
    const p = url.pathname;

    if (p === "/api/library/overview") {
      return { status: 200, body: getOverview() };
    }

    if (p === "/api/library/favorites" && method === "GET") {
      return { status: 200, body: { ok: true, items: favorites } };
    }

    if (p === "/api/library/favorites" && method === "POST") {
      const id = String(body?.id || "").trim();
      if (!id || !body?.title) {
        return { status: 400, body: { error: "無效的館藏收藏項目。" } };
      }
      const nextItem = toFavSnapshot({ ...body, id, savedAt: new Date().toISOString() });
      const next = [nextItem, ...favorites.filter((item) => item.id !== id)];
      saveDemoFavorites(next);
      return { status: 200, body: { ok: true, item: nextItem, items: next } };
    }

    const favDeleteMatch = method === "DELETE" && p.match(/^\/api\/library\/favorites\/([^/]+)$/);
    if (favDeleteMatch) {
      const id = decodeURIComponent(favDeleteMatch[1]);
      const next = favorites.filter((item) => item.id !== id);
      saveDemoFavorites(next);
      return { status: 200, body: { ok: true, removed: next.length !== favorites.length, items: next } };
    }

    if (p === "/api/library/catalog/search") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const field = url.searchParams.get("field") || "ALL";
      const scope = url.searchParams.get("scope") || "ALL";
      const preset = url.searchParams.get("preset") || "";
      const sort = url.searchParams.get("sort") || "RE";
      const tags = url.searchParams.getAll("tag").filter(Boolean);
      const rawPageSize = Number.parseInt(url.searchParams.get("pageSize") || "24", 10);
      const pageSize = [12, 24, 36, 48].includes(rawPageSize) ? rawPageSize : 24;

      let filtered = catalog.slice();
      if (preset) {
        filtered = filtered.filter((b) => b.preset === preset);
      } else if (scope && scope !== "ALL") {
        filtered = filtered.filter((b) => b.scopes.includes(scope));
      }

      if (q) {
        filtered = filtered.filter((b) => {
          if (field === "TITLE") return b.title.toLowerCase().includes(q);
          if (field === "AUTHOR") return b.author.toLowerCase().includes(q);
          if (field === "SUBJECT") return b.subjects.some((s) => s.toLowerCase().includes(q)) || b.topic[1].toLowerCase().includes(q);
          if (field === "ISBN") return b.isbn.toLowerCase().includes(q);
          if (field === "BARCODE") return b.holdings.some((h) => h.barcode.toLowerCase().includes(q));
          return `${b.title} ${b.author} ${b.isbn} ${b.subjects.join(" ")} ${b.topic[1]} ${b.publisher}`.toLowerCase().includes(q);
        });
      }

      for (const qf of tags) {
        const parts = qf.split("\t");
        const groupKey = parts[0];
        const code = parts[2];
        filtered = filtered.filter((b) => {
          if (groupKey === "TOPIC") return b.topic[0] === code;
          if (groupKey === "LANGUAGE") return b.lang[0] === code;
          if (groupKey === "PUBYEAR") return String(b.year) === String(code);
          if (groupKey === "SDGS") return b.sdg[0] === code;
          return true;
        });
      }

      if (sort === "PD") filtered.sort((a, b) => b.year - a.year || a.id - b.id);
      else if (sort === "PA") filtered.sort((a, b) => a.year - b.year || a.id - b.id);
      else if (sort === "TL") filtered.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
      else if (sort === "AT") filtered.sort((a, b) => a.author.localeCompare(b.author, "zh-Hant"));

      const totalResults = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
      const page = Math.min(totalPages, Math.max(1, Number(url.searchParams.get("page")) || 1));
      const start = (page - 1) * pageSize;
      const pageItems = filtered.slice(start, start + pageSize);

      return {
        status: 200,
        body: {
          query: url.searchParams.get("q") || "",
          field,
          scope,
          preset,
          sort,
          tags,
          page,
          pageSize,
          totalPages,
          totalResults,
          availabilityPending: false,
          facets: computeFacets(filtered.length ? filtered : catalog),
          items: pageItems,
        },
      };
    }

    if (p === "/api/library/catalog/availability") {
      const ids = (url.searchParams.get("ids") || "").split(",").map(Number).filter(Boolean);
      const items = {};
      for (const id of ids) {
        const b = byId.get(id);
        if (b) {
          items[String(id)] = {
            availableCount: b.availableCount,
            totalCount: b.totalCount,
            holdsCount: b.holdsCount,
            holdable: b.holdable,
          };
        }
      }
      return { status: 200, body: { items } };
    }

    if (p === "/api/library/catalog/item") {
      const itemPath = url.searchParams.get("path") || "";
      const id = Number(itemPath.match(/(\d+)/)?.[1]);
      const hit = byId.get(id);
      if (!hit) return { status: 404, body: { error: "找不到示範館藏條目。" } };
      return {
        status: 200,
        body: {
          ...hit,
          availability: {
            availableCount: hit.availableCount,
            totalCount: hit.totalCount,
            holdsCount: hit.holdsCount,
          },
        },
      };
    }

    if (p === "/api/library/opac/renew" && method === "POST") {
      const itemIds = new Set(Array.isArray(body?.itemIds) ? body.itemIds : []);
      let renewed = 0;
      for (const loan of account.checkouts) {
        if (!itemIds.has(loan.id) || !loan.renewable) continue;
        loan.dueDate = addDaysIso(loan.dueDate, 14);
        loan.renewalCount += 1;
        loan.renewals = `已續借 ${loan.renewalCount} 次（示範到期延後 14 天）`;
        renewed += 1;
      }
      return {
        status: 200,
        body: {
          message: renewed ? `示範模式：已為 ${renewed} 筆借閱延長 14 天到期日。` : "未選取可續借項目。",
        },
      };
    }

    if (p === "/api/library/rooms/carrel/availability") {
      const now = new Date();
      const year = Number(url.searchParams.get("year")) || now.getFullYear();
      const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;
      return { status: 200, body: buildCalendarMonth(year, month) };
    }

    if (p === "/api/library/rooms/carrel/book" && method === "POST") {
      const room = String(body?.room || "1");
      const dateStart = String(body?.dateStart || isoDay(1));
      const dateEnd = String(body?.dateEnd || dateStart);
      const periodLabels = { "1": "整天", "2": "9時-13時", "3": "13時-17時", "4": "17時-21時" };
      const periodLabel = periodLabels[String(body?.timePeriod || "2")] || "9時-13時";
      const created = {
        targetId: `carrel-${++nextCarrelSeq}`,
        roomNumber: room,
        room: `研究小間 10F-${room}`,
        dateStart,
        dateEnd,
        dateRange: `${dateStart} ~ ${dateEnd}`,
        timePeriod: periodLabel,
        status: "已預約（示範）",
        canCancel: true,
      };
      reservations = [created, ...reservations];
      return { status: 200, body: { message: `示範模式：已完成 研究小間 10F-${room}（${dateStart} ${periodLabel}）預約。` } };
    }

    if (p === "/api/library/rooms/carrel/cancel" && method === "POST") {
      const id = String(body?.targetId || "");
      reservations = reservations.filter((r) => r.targetId !== id);
      return { status: 200, body: { ok: true } };
    }

    if (p === "/api/library/databases") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const college = url.searchParams.get("college") || "";
      const language = url.searchParams.get("language") || "";
      const filtered = DEMO_DATABASES.filter((db) => {
        if (q && !`${db.name} ${db.description} ${db.college}`.toLowerCase().includes(q)) return false;
        if (college && college !== "全校" && db.college !== college) return false;
        if (language && db.language !== language) return false;
        return true;
      });
      return { status: 200, body: { count: filtered.length, items: filtered } };
    }

    return { status: 404, body: { error: "示範模式未實作此圖書館端點。" } };
  };
}
