# NUTC Portal Userscript

NUTC Portal 的互動式 ePortal 登入完全發生在使用者目前的瀏覽器。

普通 Dashboard 網頁無法跨網域讀取 `eportal.nutc.edu.tw` 的 DOM，因此 repo 內提供一個 userscript，只負責偵測官方 ePortal 是否已登入並通知 Dashboard。

## 安裝 / 更新

直接從 Dashboard 開啟：

```text
/userscript/nutc-portal.user.js
```

或從 repository 的：

```text
public/userscript/nutc-portal.user.js
```

安裝到支援 userscript 的管理器。

官方 GitHub 原始碼安裝網址：

```text
https://raw.githubusercontent.com/Rynowastaken/Personal-NUTC-Eportal/main/public/userscript/nutc-portal.user.js
```

如果是舊 repository 安裝的 userscript，更新後請確認沒有同時啟用兩份腳本，詳見 [遷移指南](migration.md)。

userscript metadata 已包含 `@updateURL` / `@downloadURL`，支援自動更新的 userscript manager 可自行檢查新版。

## Mobile flow

Dashboard 會把一次性 nonce 與 return URL 放在 ePortal URL fragment。

登入成功後：

- 若瀏覽器保留 `window.opener`，userscript 用 `postMessage` 通知原 Dashboard。
- 若行動瀏覽器沒有 opener，userscript 直接導回 Dashboard。
- 如果登入是由某個模組卡片觸發，回到 Dashboard 後會自動接著進入該模組。

## Scope

Userscript 僅執行於：

```text
https://eportal.nutc.edu.tw/*
```

目前使用 `@grant none`，不需要 browser-extension cookie API，也不讀取 HttpOnly cookie。

它只根據登入後頁面狀態判斷成功，然後通知 Dashboard。

因此它適合桌面與支援 userscript 的行動瀏覽器，而且不需要 server-side Chromium / noVNC。


## Profile identity

ePortal currently exposes no useful Web Storage values for this purpose, so the
userscript does not enumerate or upload `localStorage` / `sessionStorage`.

After login is confirmed, it reads the display name from `.name.me-4` and uses that
normalized text as the deterministic local seed. The seed is hashed with SHA-256 in the
browser and only the resulting profile ID plus display name is sent through the
Dashboard bridge to `/api/sync`.

The other user-related DOM areas discovered so far are message/modal/template regions
whose contents are not yet proven stable, so they are deliberately excluded from the
seed for now.

This profile ID is a routing hint for this personal dashboard, not a school-issued
student/account identifier. Two users with identical visible identity text can collide,
and changes to the visible identity text can produce a different ID.

The persisted file is `data/preferences.json`, which is ignored by Git.

## TronClass 重新設計

另一份獨立的 userscript，把 TronClass（`tc.nutc.edu.tw`）學生每天會用到的頁面重新做過，外觀和 Dashboard 一致：深梅色背景、Albert Sans、粉色強調色、6px 圓角的平面卡片。

安裝網址：

```text
https://raw.githubusercontent.com/Rynowastaken/Personal-NUTC-Eportal/main/public/userscript/tronclass-theme.user.js
```

已經裝過舊版「TronClass Theme」的話不用重裝，userscript manager 更新後就會是新版。

### 重新設計的頁面

| 頁面 | 內容 |
| --- | --- |
| 首頁（`/user/index`） | 依截止時間排序的待辦，以及本學期課程（最近開啟的排前面） |
| 課程（`/user/courses`） | 進行中／未開始／已結束切換與搜尋 |
| 單一課程 | 依章節排列的內容、完成狀態、繼續學習、成績 |
| 教材 | 檔案列表，用 TronClass 自己的 PDF 檢視器預覽，開啟時記錄已讀 |
| 影片 | YouTube 播放器，只記錄實際播放過的片段；老師設定離開視窗暫停時照樣暫停 |
| 作業 | 狀態、截止時間、說明、老師附件、自己的繳交紀錄 |
| 測驗 | 作答期間、限時、次數、題數、成績 |

這些頁面直接使用 TronClass 的 JSON API 和瀏覽器現有的登入，不會把任何資料送到其他地方。

### 仍然交給原版 TronClass 的部分

- **測驗作答**：按「開始作答」會進入原版的測驗頁，保留規則確認、資格檢查、全螢幕與防作弊監控。重新做的介面不會繞過這些設定。
- **繳交作業**：檔案上傳目前仍在原版頁面進行。
- 其他頁面（討論區、問卷、點名等）照常顯示原版 TronClass，套用深色主題。

每一頁右上角的選單和頁尾都有「用原版開啟此頁」，只對那一次載入有效。
