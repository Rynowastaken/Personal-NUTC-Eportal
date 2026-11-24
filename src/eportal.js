export const EPORTAL_ORIGIN = "https://eportal.nutc.edu.tw";
export const EPORTAL_HOME = `${EPORTAL_ORIGIN}/`;
export const EPORTAL_LOGIN = `${EPORTAL_ORIGIN}/login.php`;
export const EPORTAL_DASHBOARD = `${EPORTAL_ORIGIN}/nutc_dashboard/`;

const DISCOVERED_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DISCOVERED_PATH_PATTERN =
  /^(?:\/\?app_id=[A-Za-z0-9_-]{1,64}|\/ext_module\/ext_set_param\.php\?mod_id=[A-Za-z0-9_=-]{1,128})$/;
const MAX_DISCOVERED_MODULES = 32;

export const MODULES = Object.freeze([
  {
    id: "ais",
    name: "學生管理系統",
    shortName: "學生管理",
    description: "課表、學籍與學生資訊",
    uuid: "8a782d88-721c-4545-a5b7-c6a986158c64",
    path: "/?app_id=NUTC_6401",
    sourceColor: "#a742ae",
    icon: "graduation-cap",
    serverHandoff: true,
    defaultPinned: true,
    // The portal's own rebuilt student hub; /go/ais still opens AIS itself.
    appPath: "/ais",
  },
  {
    id: "webmail",
    name: "WebMail郵件系統",
    shortName: "WebMail",
    description: "校務信箱與通知",
    uuid: "26645edb-4114-4322-a3f1-96d569928b6d",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_lPGpV8f9YqQ8qgA9cyn8QA",
    sourceColor: "#4e7dda",
    icon: "mail",
    serverHandoff: true,
    defaultPinned: true,
  },
  {
    id: "activity",
    name: "活動報名暨投票系統",
    shortName: "活動報名",
    description: "活動、報名與投票",
    uuid: "e407696e-de54-429a-8e5a-93bdd3c2586e",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_PI9bsUzimpCHrDSTPoMVcQ",
    sourceColor: "#da5e0b",
    icon: "clipboard-check",
    serverHandoff: true,
    defaultPinned: true,
  },
  {
    id: "ep",
    name: "學生學習歷程(EP)跨平台整合系統",
    shortName: "學習歷程",
    description: "EP 學習歷程與成果",
    uuid: "21b57b37-4685-490d-b127-05f5eefe6735",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_pmabVqSXTYna294Vl9JLJg",
    sourceColor: "#d75656",
    icon: "route",
    serverHandoff: true,
    defaultPinned: true,
  },
  {
    id: "tronclass",
    name: "TronClass創新教學平台",
    shortName: "TronClass",
    description: "課程、教材、作業與測驗",
    uuid: "d54250aa-edce-4fa2-8cdc-9d708537cccb",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_OBbFAusuXIjtGB-G8RS4gQ",
    sourceColor: "#a742ae",
    icon: "book-open-check",
    serverHandoff: true,
    defaultPinned: true,
    // The portal's own rebuilt TronClass pages; /go/tronclass still opens
    // TronClass itself.
    appPath: "/tronclass",
  },
  {
    id: "library",
    name: "圖書館資訊系統暨電子期刊資料庫",
    shortName: "圖書館系統",
    description: "館藏查詢與電子期刊",
    uuid: "ee517564-07f6-4c80-a5e8-ef1af4762ece",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_WiHvt1-PFCvu-PsKfEIn8w",
    sourceColor: "#da5e0b",
    icon: "library",
    serverHandoff: true,
    defaultPinned: false,
    // The portal's own rebuilt library hub; /go/library still opens library SSO.
    appPath: "/library",
  },
  {
    id: "code-judger",
    name: "Code Judger平臺",
    shortName: "Code Judger",
    description: "程式解題與線上評測",
    uuid: "b17ecaca-f030-4a5f-a7fa-3f26cbd6efd4",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_hdfNE_erDoXVO3Pg-NLy7Q",
    sourceColor: "#d9a938",
    icon: "code-2",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "learning-outcomes",
    name: "教學品保暨學習成效系統",
    shortName: "教學品保",
    description: "教學評量與學習成效",
    uuid: "c9bfe024-777b-4f18-a542-e61f09bdb3b6",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_d__gzNdbk65pxiOeFQ4csg",
    sourceColor: "#4f9d69",
    icon: "bar-chart-3",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "ucan",
    name: "UCAN大專校院就業職能平台",
    shortName: "UCAN 職能",
    description: "職能診斷與職涯探索",
    uuid: "b55a9f5f-b084-4a6b-980e-b036abbbecef",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_u_S1I969H1Gcb8RFQuVy-Q",
    sourceColor: "#4e7dda",
    icon: "compass",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "language-center",
    name: "語言中心外語自學軟體",
    shortName: "外語自學",
    description: "外語學習資源與軟體",
    uuid: "9bb09c39-c3e2-446b-a0b5-3d00658d855c",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_rqNJbdZBerH70SYfFWHwgg",
    sourceColor: "#90a32e",
    icon: "languages",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "campus-card",
    name: "校園IC卡線上掛失作業",
    shortName: "IC 卡掛失",
    description: "學生證與 IC 卡掛失",
    uuid: "96b12096-dae8-426c-93a4-d41378215fec",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_-r8UUjj2Cbe570UBliaF7w",
    sourceColor: "#8b63c7",
    icon: "credit-card",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "general-affairs",
    name: "總務系統(設備報修系統)",
    shortName: "總務報修",
    description: "校園設備與場地報修",
    uuid: "aa2e1c26-987d-4c4b-8c6e-9cf1de818ec9",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_2h5NfoGoOQ4YVWULckFmhw",
    sourceColor: "#4ba3c7",
    icon: "wrench",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "counseling",
    name: "諮商e化系統",
    shortName: "諮商系統",
    description: "心理諮商預約與服務",
    uuid: "381aef0d-e91d-41ff-bb8c-bb486fd439b2",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_CF-M6podfqKD4cowl4XM5Q",
    sourceColor: "#e67e45",
    icon: "message-circle-heart",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "epidemic-report",
    name: "防疫-自主回報系統（學生）",
    shortName: "自主回報",
    description: "健康與自主回報登記",
    uuid: "c793f033-8c8e-45f8-bd3a-34ff0122e8d4",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_gO4d-m5Avjkelcxddj367w",
    sourceColor: "#2da6a0",
    icon: "heart-pulse",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "rd-service",
    name: "研發整合服務系統",
    shortName: "研發整合",
    description: "研發計畫與相關服務",
    uuid: "f9e57f7a-4b1d-47be-82f6-88e2f18c3cbe",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_hGYZutzRjQWeiydMjvjLig",
    sourceColor: "#6d59b8",
    icon: "flask-conical",
    serverHandoff: true,
    defaultPinned: false,
  },
  {
    id: "tronclass-app",
    name: "TronClass創新教學平台 APP",
    shortName: "TronClass APP",
    description: "行動版教學平台應用",
    uuid: "697cb3c7-2846-41ff-94e4-cd606da8b80c",
    path: "/ext_module/ext_set_param.php?mod_id=_OSL256_UJo4ihRt8li05nCtk5im9g",
    sourceColor: "#62b576",
    icon: "smartphone",
    serverHandoff: true,
    defaultPinned: false,
  },
]);

const MODULES_BY_ID = new Map(MODULES.map((module) => [module.id, module]));
const MODULES_BY_UUID = new Map(
  MODULES.map((module) => [module.uuid.toLowerCase(), module]),
);

const discoveredPathOverrides = new Map();
const discoveredExtraById = new Map();
const discoveredExtraByUuid = new Map();

function sanitizeModuleTitle(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allocateDiscoveredId(uuid) {
  const compact = uuid.replace(/-/g, "").toLowerCase();
  for (let len = 8; len <= compact.length; len += 4) {
    const candidate = `ext-${compact.slice(0, len)}`;
    if (!MODULES_BY_ID.has(candidate) && !discoveredExtraById.has(candidate)) {
      return candidate;
    }
  }
  return `ext-${compact}`;
}

export function defaultPinnedModuleIds() {
  return MODULES.filter((module) => module.defaultPinned).map(
    (module) => module.id,
  );
}

export function syncDiscoveredModules(rawEntries = []) {
  if (!Array.isArray(rawEntries)) return [];
  const added = [];

  for (const entry of rawEntries) {
    const uuid = String(entry?.uuid || "").trim().toLowerCase();
    const modulePath = String(entry?.path || "").trim();
    if (!DISCOVERED_UUID_PATTERN.test(uuid)) continue;
    if (!DISCOVERED_PATH_PATTERN.test(modulePath)) continue;

    const curated = MODULES_BY_UUID.get(uuid);
    if (curated) {
      if (modulePath !== curated.path) {
        discoveredPathOverrides.set(uuid, modulePath);
      } else {
        discoveredPathOverrides.delete(uuid);
      }
      continue;
    }

    const title = sanitizeModuleTitle(entry?.name || entry?.text);
    if (!title) continue;
    const name = title.slice(0, 40);
    const shortName = title.slice(0, 16);

    const existing = discoveredExtraByUuid.get(uuid);
    if (existing) {
      const updated = Object.freeze({
        ...existing,
        name,
        shortName,
        path: modulePath,
      });
      discoveredExtraByUuid.set(uuid, updated);
      discoveredExtraById.set(existing.id, updated);
      continue;
    }

    if (discoveredExtraByUuid.size >= MAX_DISCOVERED_MODULES) continue;

    const id = allocateDiscoveredId(uuid);
    const created = Object.freeze({
      id,
      name,
      shortName,
      description: "ePortal 校務系統",
      uuid,
      path: modulePath,
      icon: "external-link",
      serverHandoff: true,
      defaultPinned: false,
      discovered: true,
    });
    discoveredExtraByUuid.set(uuid, created);
    discoveredExtraById.set(id, created);
    added.push(created);
  }

  return added;
}

export function resetDiscoveredModules() {
  discoveredPathOverrides.clear();
  discoveredExtraById.clear();
  discoveredExtraByUuid.clear();
}

export function moduleById(moduleId) {
  const curated = MODULES_BY_ID.get(moduleId);
  if (curated) {
    const override = discoveredPathOverrides.get(curated.uuid.toLowerCase());
    return override ? { ...curated, path: override } : curated;
  }
  const extra = discoveredExtraById.get(moduleId);
  if (extra) return extra;
  throw new Error("Unknown ePortal module.");
}

export function moduleUrl(moduleId) {
  return new URL(moduleById(moduleId).path, EPORTAL_ORIGIN).toString();
}

export function publicModules() {
  return [...MODULES, ...discoveredExtraById.values()].map(
    ({ path, appPath, ...module }) =>
      Object.freeze({
        ...module,
        defaultPinned: Boolean(module.defaultPinned),
        launchPath: appPath || `/go/${module.id}`,
      }),
  );
}
