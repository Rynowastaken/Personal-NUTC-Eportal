import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeHtmlEntities,
  stripHtml,
  htmlToCleanParagraphs,
  stripBookstorePromo,
  cleanAuthorText,
  cleanBookDescription,
  maskLibraryIdentifier,
  normalizeIsbn,
  sanminCoverUrlFromIsbn,
  buildOpacAvailabilityUrl,
  parseSanminProductDetail,
  parseLibraryPortalLinks,
  parseEndnoteDownloads,
  parseDatabasesList,
  parseOpacFacets,
  parseOpacSearchResults,
  mergeOpacAvailability,
  mergeOpacItemLookup,
  parseOpacItemDetail,
  parseOpacLookupTitleInfoUrl,
  parseOpacAccount,
  parseOpacLoginForm,
  parseOpacMyLists,
  parseCarrelForm,
  parseCarrelCalendar,
  parseCarrelReservations,
} from "../src/library-parsers.js";

test("decodeHtmlEntities and stripHtml safely normalize library HTML fragments", () => {
  assert.equal(decodeHtmlEntities("A &amp; B &#39;C&#39; &#x2713;"), "A & B 'C' ✓");
  assert.equal(
    stripHtml('<p>Hello<script>alert(1)</script><style>.x{}</style><br>World &amp; <b>All</b></p>'),
    "Hello World & All",
  );
});

test("maskLibraryIdentifier masks card/student identifiers cleanly", () => {
  assert.equal(maskLibraryIdentifier(""), "");
  assert.equal(maskLibraryIdentifier("1234"), "****");
  assert.equal(maskLibraryIdentifier("1411501046"), "141*****46");
  assert.equal(maskLibraryIdentifier(" 1411501046 "), "141*****46");
});

test("parseLibraryPortalLinks extracts SSO destinations and drops javascript URLs", () => {
  const html = `
    <a href="javascript:void(0)">館藏查詢、圖書預約</a>
    <a href="https://ntit.ent.sirsidynix.net/custom/web/decryptuid.html?u=abc">館藏查詢、圖書預約</a>
    <a href="CheckSSO.aspx?url=OrderRoom2.aspx">預約研究小間</a>
    <a href="CheckSSO.aspx?url=CancelRoom2.aspx">研究小間預約紀錄</a>
    <a href="CheckSSO.aspx?url=OrderRoom1.aspx">預約團體討論室</a>
    <a href="CheckSSO.aspx?url=OrderRoom.aspx">預約團體放映室</a>
    <a href="OrderRoom.aspx?t=t">預約新生利用教育</a>
    <a href="https://brs.nutc.edu.tw/recommend">書刊推薦</a>
    <a href="activeacc2.aspx">讀者權益聲明</a>
    <a href="resetPIN.aspx">重設館藏查詢密碼</a>
    <a href="/database/search/indexDB.asp">資料庫</a>
    <a href="https://example.serialssolutions.com/ejournals">電子期刊</a>
    <a href="dslist.aspx">Endnote 下載</a>
  `;
  const links = parseLibraryPortalLinks(html);
  assert.equal(links.opac, "https://ntit.ent.sirsidynix.net/custom/web/decryptuid.html?u=abc");
  assert.equal(links.carrel, "https://library.nutc.edu.tw/sso/CheckSSO.aspx?url=OrderRoom2.aspx");
  assert.equal(links.carrelCancel, "https://library.nutc.edu.tw/sso/CheckSSO.aspx?url=CancelRoom2.aspx");
  assert.equal(links.groupDiscuss, "https://library.nutc.edu.tw/sso/CheckSSO.aspx?url=OrderRoom1.aspx");
  assert.equal(links.groupScreening, "https://library.nutc.edu.tw/sso/CheckSSO.aspx?url=OrderRoom.aspx");
  assert.equal(links.orientation, "https://library.nutc.edu.tw/sso/OrderRoom.aspx?t=t");
  assert.equal(links.recommend, "https://brs.nutc.edu.tw/recommend");
  assert.equal(links.patronRights, "https://library.nutc.edu.tw/sso/activeacc2.aspx");
  assert.equal(links.resetPin, "https://library.nutc.edu.tw/sso/resetPIN.aspx");
  assert.equal(links.databases, "https://library.nutc.edu.tw/database/search/indexDB.asp");
  assert.equal(links.ejournals, "https://example.serialssolutions.com/ejournals");
  assert.equal(links.endnote, "https://library.nutc.edu.tw/sso/dslist.aspx");
});

test("parseEndnoteDownloads extracts unique installers and infers platform", () => {
  const html = `
    <a href="dlfile.aspx?fid=101&amp;fk=abc1">EndNote 21 WIN 安裝檔</a>
    <a href="dlfile.aspx?fid=102&amp;fk=abc2">EndNote 21 MAC dmg</a>
    <a href="dlfile.aspx?fid=101&amp;fk=dup">Duplicate</a>
    <a href="dlfile.aspx?fid=103&amp;fk=abc3">中文書目格式 Style 包</a>
  `;
  const list = parseEndnoteDownloads(html);
  assert.deepEqual(list, [
    { fid: "101", fk: "abc1", title: "EndNote 21 WIN 安裝檔", platform: "Windows" },
    { fid: "102", fk: "abc2", title: "EndNote 21 MAC dmg", platform: "macOS" },
    { fid: "103", fk: "abc3", title: "中文書目格式 Style 包", platform: "其他" },
  ]);
});

test("parseDatabasesList extracts rows from DatabasesList.asp", () => {
  const html = `
    <table>
      <tr class="dataresult">
        <td><a href="https://ieeexplore.ieee.org/">IEEE Xplore (IEL)</a></td>
        <td>網域內 / 校外連線</td>
        <td>收錄電機電子與資訊期刊、會議論文集。</td>
        <td><a href="guides/ieee.pdf">使用手冊</a></td>
        <td>2027/12/31</td>
        <td><a href="Detail.asp?Item=DB42">詳細</a></td>
      </tr>
    </table>
  `;
  const rows = parseDatabasesList(html);
  assert.deepEqual(rows, [
    {
      id: "DB42",
      name: "IEEE Xplore (IEL)",
      url: "https://ieeexplore.ieee.org/",
      accessType: "網域內 / 校外連線",
      description: "收錄電機電子與資訊期刊、會議論文集。",
      guideUrl: "https://library.nutc.edu.tw/database/search/guides/ieee.pdf",
      expiry: "2027/12/31",
      detailUrl: "https://library.nutc.edu.tw/database/search/Detail.asp?Item=DB42",
    },
  ]);
});

test("parseOpacSearchResults and mergeOpacAvailability parse hits, covers, pagination, and counts", () => {
  const html = `
    <div class="resultsToolbar_num_results">25 個結果</div>
    <script>
      var url = 'https://ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/results.displaypanel.any_0:loadavailability/173?qu=JS';
    </script>
    <div id="hitlist0_BOOKCOVER"><div class="BOOKCOVER_value">https://cdnec.sanmin.com.tw/cover.jpg</div></div>
    <div id="results_cell0" class="results_cell">
      <div>
        <input type="hidden" value="ent://SD_ILS/0/SD_ILS:226822" />
        <input class="isbnValue" value="9789864761234" />
        <div class="displayDetailLink"><a id="detailLink0" href="#">JavaScript 權威指南 &amp; 實戰</a></div>
        <div class="displayElementText INITIAL_AUTHOR_SRCH">David Flanagan</div>
        <div class="displayElementText PUBYEAR">2021</div>
        <div class="displayElementText LIBRARY">三民總館</div>
        <div class="displayElementText CALLNUMBER">312.93 8456</div>
      </div>
    </div>
  `;
  const parsed = parseOpacSearchResults(html, { query: "JavaScript", page: 1 });
  assert.equal(parsed.totalResults, 25);
  assert.equal(parsed.totalPages, 3);
  assert.equal(
    parsed.availabilityUrl,
    "https://ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/results.displaypanel.any_0:loadavailability/173?qu=JS",
  );
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].id, "226822");
  assert.equal(parsed.items[0].title, "JavaScript 權威指南 & 實戰");
  assert.equal(parsed.items[0].isbn, "9789864761234");
  assert.equal(parsed.items[0].rawCoverUrl, "https://cdnec.sanmin.com.tw/cover.jpg");

  const merged = mergeOpacAvailability(parsed.items, [
    {
      titleId: "226822",
      availableCount: "2",
      copyCount: "3",
      holdCount: "1",
      holdable: true,
    },
  ]);
  assert.equal(merged[0].availableCount, 2);
  assert.equal(merged[0].totalCount, 3);
  assert.equal(merged[0].holdsCount, 1);
  assert.equal(merged[0].holdable, true);
});

test("parseOpacFacets extracts SUBJECT, LANGUAGE, PUBDATE (newest first), ITYPE, and SDGs", () => {
  const html = `
    <form id="facetFormPUBDATE">
      <div class="facetTitle">出版日期</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=PUBDATE%09%E5%87%BA%E7%89%88%E6%97%A5%E6%9C%9F%092018%092018"> 2018 </a></span><div class="navigatorCount"> (120) </div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=PUBDATE%09%E5%87%BA%E7%89%88%E6%97%A5%E6%9C%9F%092025%092025"> 2025 </a></span><div class="navigatorCount"> (45) </div>
    </form>
    <form id="facetFormLANGUAGE">
      <div class="facetTitle">語言</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=LANGUAGE%09%E8%AA%9E%E8%A8%80%09CHI%09%E4%B8%AD%E6%96%87"> 中文 </a></span><div class="navigatorCount"> (420,985) </div>
    </form>
    <form id="facetFormSUBJECT">
      <div class="facetTitle">主題</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=SUBJECT%09%E4%B8%BB%E9%A1%8C%09Computer+Science.%09Computer+Science."> Computer Science. </a></span><div class="navigatorCount"> (6057) </div>
    </form>
    <form id="facetFormITYPE">
      <div class="facetTitle">資料類型</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=ITYPE%09%E8%B3%87%E6%96%99%E9%A1%9E%E5%9E%8B%091%3ABOOK%09%E5%9C%96%E6%9B%B8"> 圖書 </a></span>
    </form>
    <form id="facetFormLOCAL_NOTE_590">
      <div class="facetTitle">SDGS附註</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=LOCAL_NOTE_590%09SDGS%E9%99%84%E8%A8%BB%09SDG4%09SDG4+%E5%84%AA%E8%B3%AA%E6%95%99%E8%82%B2"> SDG4 優質教育 </a></span><div class="navigatorCount"> (291) </div>
    </form>
  `;
  const facets = parseOpacFacets(html);
  assert.deepEqual(
    facets.map((g) => g.key),
    ["SUBJECT", "LANGUAGE", "PUBDATE", "ITYPE", "LOCAL_NOTE_590"],
  );
  assert.deepEqual(facets[0].items[0], {
    qf: "SUBJECT\t主題\tComputer Science.\tComputer Science.",
    label: "Computer Science.",
    count: 6057,
  });
  assert.equal(facets[1].items[0].count, 420985);
  assert.deepEqual(
    facets[2].items.map((x) => x.label),
    ["2025", "2018"],
  );
  assert.equal(facets[3].items[0].count, null);
  assert.equal(facets[4].items[0].label, "SDG4 優質教育");

  const parsed = parseOpacSearchResults(html, { sort: "PD", tags: ["LANGUAGE\t語言\tCHI\t中文"] });
  assert.equal(parsed.sort, "PD");
  assert.deepEqual(parsed.tags, ["LANGUAGE\t語言\tCHI\t中文"]);
  assert.equal(parsed.facets.length, 5);

  const multiQfHtml = `
    <form id="facetFormSUBJECT">
      <div class="facetTitle">主題</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=SUBJECT%09%E4%B8%BB%E9%A1%8C%09%E5%B0%8F%E8%AA%AA%09%E5%B0%8F%E8%AA%AA&amp;qf=SUBJECT%09%E4%B8%BB%E9%A1%8C%09%E6%97%A5%E6%9C%AC%E6%96%87%E5%AD%B8%09%E6%97%A5%E6%9C%AC%E6%96%87%E5%AD%B8">日本文學</a></span><div class="navigatorCount">(1674)</div>
      <span class="navigatorName"><a href="/client/zh_TW/NUTC/search/results.displaypanel.limitcolumn.navigatorclick?qf=SUBJECT%09%E4%B8%BB%E9%A1%8C%09%E5%B0%8F%E8%AA%AA%09%E5%B0%8F%E8%AA%AA&amp;qf=SUBJECT%09%E4%B8%BB%E9%A1%8C%09%E7%BE%8E%E5%9C%8B%E6%96%87%E5%AD%B8%09%E7%BE%8E%E5%9C%8B%E6%96%87%E5%AD%B8">美國文學</a></span><div class="navigatorCount">(1125)</div>
    </form>
  `;
  const multiFacets = parseOpacFacets(multiQfHtml, ["SUBJECT\t主題\t小說\t小說"]);
  assert.deepEqual(multiFacets[0].items, [
    { qf: "SUBJECT\t主題\t日本文學\t日本文學", label: "日本文學", count: 1674 },
    { qf: "SUBJECT\t主題\t美國文學\t美國文學", label: "美國文學", count: 1125 },
  ]);
});

test("parseOpacItemDetail parses bibliographic metadata and holdings table rows", () => {
  const detailPath = "/client/zh_TW/NUTC/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:226822/one";
  const html = `
    <div class="displayElementText INITIAL_TITLE_SRCH">深入淺出演算法</div>
    <div class="displayElementText PERSONAL_AUTHOR">Aditya Bhargava</div>
    <div class="displayElementText PUBLICATION_INFO">台北 : 碁峰, 2022</div>
    <div class="displayElementText ISBN">9789865029999</div>
    <div class="displayElementText EDITION">初版</div>
    <div class="displayElementText PHYSICAL_DESC">256 頁 : 圖 ; 23 公分</div>
    <div class="displayElementText SERIES">圖解系列</div>
    <div class="displayElementText LANGUAGE">中文</div>
    <div class="displayElementText SUBJECT_TERM">演算法</div>
    <div class="displayElementText SUBJECT_TERM">資料結構</div>
    <div class="displayElementText GENERAL_NOTE">附索引</div>
    <div class="displayElementText ELECTRONIC_ACCESS"><a href="https://ebooks.example.edu.tw/view/123">線上全文</a></div>
    <div class="displayElementText SUMMARY">圖解演算法入門。</div>
    <div class="BOOKCOVER_value">https://cdnec.sanmin.com.tw/999.jpg</div>
    <table>
      <tr class="detailItemsTableRow">
        <td class="detailItemsTable_LIBRARY">三民總館 4F</td>
        <td class="detailItemsTable_ITYPE">一般圖書</td>
        <td class="detailItemsTable_BARCODE">B0012345</td>
        <td class="detailItemsTable_CALLNUMBER">312.9 8234</td>
        <td class="detailItemsTable_SD_ITEM_STATUS"><div id="asyncFieldDefault0">在架上</div></td>
      </tr>
    </table>
  `;
  const detail = parseOpacItemDetail(html, detailPath);
  assert.equal(detail.title, "深入淺出演算法");
  assert.equal(detail.author, "Aditya Bhargava");
  assert.equal(detail.publisherYear, "台北 : 碁峰, 2022");
  assert.equal(detail.isbn, "9789865029999");
  assert.equal(detail.edition, "初版");
  assert.equal(detail.physicalDesc, "256 頁 : 圖 ; 23 公分");
  assert.equal(detail.series, "圖解系列");
  assert.equal(detail.language, "中文");
  assert.deepEqual(detail.subjects, ["演算法", "資料結構"]);
  assert.deepEqual(detail.notes, ["附索引"]);
  assert.equal(detail.electronicUrl, "https://ebooks.example.edu.tw/view/123");
  assert.equal(detail.summary, "圖解演算法入門。");
  assert.equal(detail.rawCoverUrl, "https://cdnec.sanmin.com.tw/999.jpg");
  assert.equal(detail.holdings.length, 1);
  assert.deepEqual(detail.holdings[0], {
    branch: "三民總館 4F",
    itemType: "一般圖書",
    barcode: "B0012345",
    callNumber: "312.9 8234",
    status: "在架上",
  });
});

test("parseOpacAccount extracts masked card ID, checkouts, holds, fines, and history", () => {
  const html = `
    <div>您的狀態： 正常</div>
    <div>借閱總計：1 預約總計：1 應付款總額：NT$15.00</div>
    <div>讀者借閱證號碼</div><td>1411501046</td>
    <div id="checkoutsTab">
      <form action="/client/zh_TW/NUTC/search/account.renewform">
        <table id="CheckoutsList">
          <tr><th>選取</th><th>題名</th><th>索書號</th><th>到期日</th><th>續借</th></tr>
          <tr>
            <td><input type="checkbox" name="checkoutsSelect" value="ITEM_1" /></td>
            <td>設計模式實戰</td>
            <td>312.93 8333</td>
            <td>2026/12/10</td>
            <td>已續借 0 次</td>
          </tr>
        </table>
      </form>
      <table id="CheckoutsHistoryList">
        <tr><th>題名</th><th>作者</th><th>日期</th></tr>
        <tr><td>Clean Code</td><td>Robert C. Martin</td><td>2026/10/01</td></tr>
      </table>
    </div>
    <div id="holdsTab">
      <table>
        <tr><td>UNIX 環境高級編程</td><td>三民總館</td><td>備妥待取</td><td>2026/11/30</td></tr>
      </table>
    </div>
    <div id="finesTab">
      <table>
        <tr><td>逾期罰款</td><td>圖書逾期</td><td>NT$15.00</td><td>2026/11/20</td></tr>
      </table>
    </div>
  `;
  const acct = parseOpacAccount(html);
  assert.equal(acct.status, "正常");
  assert.equal(acct.checkoutsCount, 1);
  assert.equal(acct.holdsCount, 1);
  assert.equal(acct.finesTotal, "NT$15.00");
  assert.equal(acct.patron.maskedId, "141*****46");
  assert.equal(acct.checkouts[0].id, "ITEM_1");
  assert.equal(acct.checkouts[0].renewable, true);
  assert.equal(acct.checkouts[0].dueDate, "2026/12/10");
  assert.equal(acct.holds[0].title, "UNIX 環境高級編程");
  assert.equal(acct.fines[0].amount, "NT$15.00");
  assert.equal(acct.history[0].title, "Clean Code");
  assert.equal(acct.renewAction, "/client/zh_TW/NUTC/search/account.renewform");
});

test("parseCarrelForm, parseCarrelCalendar, and parseCarrelReservations handle ASP.NET WebForms pages", () => {
  const formHtml = `
    <input id="__VIEWSTATE" value="VS_1" />
    <input id="__VIEWSTATEGENERATOR" value="GEN_1" />
    <input id="__EVENTVALIDATION" value="EV_1" />
    <input id="tbCrt_Date" value="11/24/2026" />
    <input id="tbName" value="測試同學" />
    <input id="tbSID" value="1411501046" />
    <input id="tbClassName" value="資工三甲" />
    <input id="tbTEL" value="0912345678" />
    <input id="tbEMail" value="s@nutc.edu.tw" />
    <input id="tbEMail1" value="alt@example.com" />
    <input type="radio" name="RBLType" checked="checked" value="研究生" />
    <select id="ddlTimePeriod">
      <option value="2">9時-13時</option>
    </select>
    <select id="ddlRoom">
      <option value="1">研究小間10F-1</option>
    </select>
    <table><tr><td>1.</td><td>限本人使用並於預約時段領取鑰匙。</td></tr></table>
  `;
  const parsedForm = parseCarrelForm(formHtml);
  assert.equal(parsedForm.hidden.__VIEWSTATE, "VS_1");
  assert.equal(parsedForm.formDefaults.role, "研究生");
  assert.equal(parsedForm.formDefaults.department, "資工三甲");
  assert.equal(parsedForm.formDefaults.rooms[0].value, "1");
  assert.equal(parsedForm.formDefaults.rules[0], "1. 限本人使用並於預約時段領取鑰匙。");

  const calHtml = `
    <div>2026年11月</div>
    <a href="javascript:__doPostBack('cal','V8000')" title="跳至上一個月">prev</a>
    <a href="javascript:__doPostBack('cal','V8100')" title="跳至下一個月">next</a>
    <table>
      <tr>
        <td style="Color:Gray"><a>31</a><span>1</span></td>
        <td><a>24</a><span>1</span><span>2</span><span>3</span></td>
        <td><a>25</a><span>已預約1</span><span>2</span></td>
      </tr>
    </table>
  `;
  const cal = parseCarrelCalendar(calHtml);
  assert.equal(cal.year, 2026);
  assert.equal(cal.month, 11);
  assert.deepEqual(cal.prevTarget, { target: "cal", arg: "V8000" });
  assert.deepEqual(cal.nextTarget, { target: "cal", arg: "V8100" });
  assert.equal(cal.days.length, 2);
  assert.deepEqual(cal.days[0].availableRooms, ["1", "2", "3"]);
  assert.equal(cal.days[0].dateKey, "2026-11-24");
  assert.ok(!cal.days[1].availableRooms.includes("1"));

  const cancelHtml = `
    <input id="__VIEWSTATE" value="CVS_1" />
    <table>
      <tr><th>空間</th><th>日期</th><th>時段</th><th>狀態</th><th>操作</th></tr>
      <tr>
        <td>研究小間10F-2</td>
        <td>2026/11/25</td>
        <td>9時-13時</td>
        <td>核准</td>
        <td><a href="javascript:__doPostBack('gv$ctl02$lbDel','')">取消</a></td>
      </tr>
    </table>
  `;
  const cancel = parseCarrelReservations(cancelHtml);
  assert.equal(cancel.hidden.__VIEWSTATE, "CVS_1");
  assert.equal(cancel.reservations.length, 1);
  assert.equal(cancel.reservations[0].room, "研究小間10F-2");
  assert.equal(cancel.reservations[0].canCancel, true);
  assert.equal(cancel.reservations[0].postbackTarget, "gv$ctl02$lbDel");
});

test("normalizeIsbn, sanminCoverUrlFromIsbn, and buildOpacAvailabilityUrl validate and format OPAC metadata", () => {
  assert.equal(normalizeIsbn("978-986-451-448-9 (平裝)"), "9789864514489");
  assert.equal(normalizeIsbn("0-596-15810-6 ; 9780596158102"), "9780596158101");
  assert.equal(normalizeIsbn("043942089X"), "9780439420891");
  assert.equal(normalizeIsbn("9791090636071"), "9791090636071");
  assert.equal(normalizeIsbn("9780596158109"), "");
  assert.equal(normalizeIsbn("not-an-isbn"), "");

  assert.equal(
    sanminCoverUrlFromIsbn("978-986-451-448-9"),
    "https://cdnec.sanmin.com.tw/product_images/986/986451448.jpg",
  );
  assert.equal(sanminCoverUrlFromIsbn("9791090636071"), "");
  assert.equal(sanminCoverUrlFromIsbn("bad"), "");

  const availUrl = buildOpacAvailabilityUrl(["226822", "bad-id", "226822", "306166"]);
  assert.equal(
    availUrl,
    "https://ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/results.displaypanel.any_0:loadavailability/$007b$0022ILS$0022:$005b$0022ent:$002f$002fSD_ILS$002f0$002fSD_ILS:226822$0022$002c$0022ent:$002f$002fSD_ILS$002f0$002fSD_ILS:306166$0022$005d$007d",
  );
  assert.equal(buildOpacAvailabilityUrl(["bad"]), "");
});

test("parseOpacSearchResults does not bleed adjacent hitlist BOOKCOVER values into empty cover slots", () => {
  const html = `
    <div id="hitlist0_BOOKCOVER"></div>
    <div id="hitlist0_CALLNUMBER"><div class="CALLNUMBER_value">123.4</div></div>
    <div id="results_cell0" class="results_cell"><div>
      <input type="hidden" value="ent://SD_ILS/0/SD_ILS:1001" />
      <input class="isbnValue" value="9789574174799" />
      <div class="displayDetailLink"><a id="detailLink0" href="#">無封面書籍</a></div>
    </div></div>
    <div id="hitlist1_BOOKCOVER"><div class="BOOKCOVER_value">https://cdnec.sanmin.com.tw/product_images/986/986451448.jpg</div></div>
    <div id="results_cell1" class="results_cell"><div>
      <input type="hidden" value="ent://SD_ILS/0/SD_ILS:1002" />
      <input class="isbnValue" value="9789864514489" />
      <div class="displayDetailLink"><a id="detailLink1" href="#">有封面書籍</a></div>
    </div></div>
  `;
  const parsed = parseOpacSearchResults(html);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].rawCoverUrl, "");
  assert.equal(
    parsed.items[1].rawCoverUrl,
    "https://cdnec.sanmin.com.tw/product_images/986/986451448.jpg",
  );
});

test("htmlToCleanParagraphs, stripBookstorePromo, and parseSanminProductDetail format clean descriptions", () => {
  assert.equal(
    htmlToCleanParagraphs("<P>第一段&amp;細節。<BR>第二行。</P><P>第二段。</P><script>evil()</script>"),
    "第一段&細節。\n第二行。\n\n第二段。",
  );
  assert.equal(htmlToCleanParagraphs("甲乙丙丁戊己庚辛", { maxLength: 5 }), "甲乙丙丁戊…");

  const withPromo =
    "【誠品會員獨家贈點】\n凡購買新書即贈 700 點。\n\n注意事項如下：\n1. 活動期間 2026 年。\n\n真正的第一段書籍簡介。\n\n真正的第二段簡介。";
  assert.equal(stripBookstorePromo(withPromo), "真正的第一段書籍簡介。\n\n真正的第二段簡介。");
  assert.equal(stripBookstorePromo("一般書籍簡介。"), "一般書籍簡介。");

  const sanminHtml = `
    <meta name="description" content="&#26360;&#21517;&#65306;&#23433;&#37027;&#20854;&#65292;ISBN&#65306;978-626-384-170-3&#65292;頁數：320，類別：台灣文學">
    <h2 id="Intro1">商品簡介</h2>
    <div class="SectionBody"><P>&#31532;&#19968;&#27573;&#31777;&#20171;&#12290;</P><P>第二段介紹。<BR>換行繼續。</P></div>
    <h2 id="Intro2">作者簡介</h2>
    <div class="SectionBody">童育園<BR>台灣小說創作者。</div>
  `;
  assert.equal(parseSanminProductDetail(sanminHtml, "9780000000002"), null);
  const parsed = parseSanminProductDetail(sanminHtml, "9786263841703");
  assert.deepEqual(parsed, {
    description: "第一段簡介。\n\n第二段介紹。\n換行繼續。",
    authorBio: "童育園\n台灣小說創作者。",
    pages: "320",
    category: "台灣文學",
    source: "三民書局",
  });
});

test("parseOpacSearchResults supports custom pageSize and preserves default 12", () => {
  const html = `<div class="resultsToolbar_num_results">25 個結果</div>`;
  const defaultParsed = parseOpacSearchResults(html, { query: "test", page: 1 });
  assert.equal(defaultParsed.pageSize, 12);
  assert.equal(defaultParsed.totalPages, 3);

  const page24 = parseOpacSearchResults(html, { query: "test", page: 1, pageSize: 24 });
  assert.equal(page24.pageSize, 24);
  assert.equal(page24.totalPages, 2);

  const page36 = parseOpacSearchResults(html, { query: "test", page: 1, pageSize: 36 });
  assert.equal(page36.pageSize, 36);
  assert.equal(page36.totalPages, 1);
});

test("parseOpacLookupTitleInfoUrl and mergeOpacItemLookup apply shelf locations and due dates per copy", () => {
  const html = `
    <script>
      $J.ajax({url: '/client/zh_TW/NUTC/search/detailnonmodal.detail.detailavailabilityaccordions:lookuptitleinfo/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:180180/ILS/0/true/true?d=ent%3A%2F%2FSD_ILS%2F0%2FSD_ILS%3A180180%7E%7E0', type: 'POST'});
    </script>
  `;
  assert.equal(
    parseOpacLookupTitleInfoUrl(html),
    "https://ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/detailnonmodal.detail.detailavailabilityaccordions:lookuptitleinfo/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:180180/ILS/0/true/true?d=ent%3A%2F%2FSD_ILS%2F0%2FSD_ILS%3A180180%7E%7E0",
  );

  const merged = mergeOpacItemLookup(
    [
      { branch: "臺中科技大學 - 三民總館", itemType: "圖書", barcode: "389752", callNumber: "861.57 1323 114", status: "未知" },
      { branch: "臺中科技大學 - 三民總館", itemType: "圖書", barcode: "389753", callNumber: "861.57 1323 114 c.2", status: "未知" },
    ],
    {
      childRecords: [
        { LIBRARY: "臺中科技大學 - 三民總館", barcode: "389752", SD_ITEM_STATUS: "10F中文書區" },
        { LIBRARY: "臺中科技大學 - 民生分館", barcode: "389753", SD_ITEM_STATUS: "到期 2026/12/7" },
      ],
    },
  );
  assert.equal(merged[0].status, "10F中文書區");
  assert.equal(merged[1].branch, "臺中科技大學 - 民生分館");
  assert.equal(merged[1].status, "到期 2026/12/7");
});

test("cleanAuthorText, cleanBookDescription, and parseOpacItemDetail clean MARC noise and preserve contributors", () => {
  assert.equal(cleanAuthorText("方丈貴惠, 1984- 著"), "方丈貴惠 著");
  assert.equal(cleanAuthorText("方丈貴惠, 1984- 作"), "方丈貴惠 作");
  assert.equal(cleanAuthorText("王小明, 1955-2020"), "王小明");
  assert.equal(
    cleanBookDescription("\"'「從現在起，要請各位賭命參加遊戲」\n\n故事開始。\n\n\""),
    "「從現在起，要請各位賭命參加遊戲」\n\n故事開始。",
  );

  const html = `
    <div class="displayElementText text-p INITIAL_TITLE_SRCH">賜給名偵探甜美的死亡</div>
    <div class="displayElementText text-p INITIAL_AUTHOR_SRCH">方丈貴惠, 1984- 著</div>
    <div class="displayElementText text-p ADDED_AUTHOR">方丈貴惠, 1984-</div>
    <div class="displayElementText text-p ADDED_AUTHOR">李彥樺</div>
    <div class="displayElementText text-p ISBN">9786267226278 (平裝)</div>
    <div class="displayElementText text-p NOTE">含參考書目</div>
    <div class="displayElementText text-p SUMMARY"><div class="nested">第一層簡介</div> 完整內容。</div>
  `;
  const detail = parseOpacItemDetail(
    html,
    "/client/zh_TW/NUTC/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:858267/one",
  );
  assert.equal(detail.author, "方丈貴惠 著");
  assert.deepEqual(detail.contributors, ["李彥樺"]);
  assert.equal(detail.isbn, "9786267226278");
  assert.equal(detail.summary, "第一層簡介 完整內容。");
  assert.deepEqual(detail.notes, ["含參考書目"]);

  const noteOnlyDetail = parseOpacItemDetail(
    `<div class="displayElementText INITIAL_TITLE_SRCH">測試書目</div><div class="displayElementText NOTE">版權頁誤植</div>`,
    "/client/zh_TW/NUTC/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:1/one",
  );
  assert.equal(noteOnlyDetail.summary, "");
  assert.deepEqual(noteOnlyDetail.notes, ["版權頁誤植"]);
});

test("parseOpacMyLists extracts saved/temp lists, items with positional bitmask indices, and Tapestry forms", () => {
  const html = `
    <div id="lists">
      <div id="lists_main">
        <form id="listsForm" action="/client/zh_TW/NUTC/search/mylists.lists.listsform?">
          <input name="t:formdata" value="FD_LISTS" type="hidden" />
          <input id="lists_action" name="lists_action" type="text" />
          <input id="lists_activeList" name="lists_activeList" type="text" />
          <input id="lists_submit" name="lists_submit" type="submit" value="submit" />
          <ul id="lists_list">
            <li id="lists_li:0"><a class="myListLink" href="/client/zh_TW/NUTC/search/mylists/0?">臨時清單 (0)</a></li>
            <li id="lists_li:42" class="activeList">
              <input type="checkbox" name="deleteCheckbox42" value="on" />
              <a class="myListLink" href="/client/zh_TW/NUTC/search/mylists/42?">專題書單 (1)</a>
            </li>
          </ul>
        </form>
        <div id="lists_createDialog">
          <form id="createListForm" action="/client/zh_TW/NUTC/search/mylists.lists.createlistform?">
            <input name="t:formdata" value="FD_CREATE" type="hidden" />
            <input id="lists_createName" name="lists_createName" type="text" />
            <input type="submit" name="createSubmit" value="保存" />
          </form>
        </div>
      </div>
      <div id="newListZone"></div>
    </div>
    <div id="myListTitle">
      <span class="myListName">專題書單</span>
      <span class="myListItemCount">1 個清單館藏</span>
    </div>
    <div class="listWrapper">
      <div id="myListItemsZone">
        <ul id="listdetails_list">
          <li class="myListItem" id="listdetails_li:ent://SD_ILS/0/SD_ILS:858267">
            <input type="checkbox" class="results_chkbox myList bulkActionCheckbox" value="ent://SD_ILS/0/SD_ILS:858267" />
            <input class="isbnValue" value="9786267226278" type="hidden" />
            <div class="displayDetailLink"><a id="detailLink0" href="#">賜給名偵探甜美的死亡</a></div>
            <div class="displayElementText AUTHOR">方丈貴惠, 1984- 著</div>
          </li>
        </ul>
      </div>
      <form id="myListForm" action="/client/zh_TW/NUTC/search/mylists.listdetails.mylistform/42?">
        <input value="FD_ITEMS" name="t:formdata" type="hidden" />
        <select id="listdetails_destList" name="listdetails_destList">
          <option value="0">臨時清單</option>
          <option value="42">專題書單</option>
        </select>
        <input id="listdetails_submit" name="listdetails_submit" type="submit" value="submit" />
      </form>
    </div>
  `;
  const parsed = parseOpacMyLists(html);
  assert.equal(parsed.loginRequired, false);
  assert.equal(parsed.activeListId, "42");
  assert.equal(parsed.activeListName, "專題書單");
  assert.equal(parsed.lists.length, 2);
  assert.equal(parsed.lists[1].deleteInputName, "deleteCheckbox42");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].id, "858267");
  assert.equal(parsed.items[0].author, "方丈貴惠 著");
  assert.equal(parsed.items[0].isbn, "9786267226278");
  assert.equal(parsed.forms.myListForm.formData, "FD_ITEMS");
  assert.equal(parsed.forms.createListForm.formData, "FD_CREATE");
  assert.equal(parsed.forms.deleteListsForm.formData, "FD_LISTS");
});

test("parseOpacAccount flags loginRequired and parseOpacLoginForm extracts #loginPageForm fields", () => {
  const loginHtml = `
    <div id="loginFormZone" class="loginForm t-zone">
      <form id="loginPageForm" method="post" action="/client/zh_TW/NUTC/search/mylists.template.patronloginform.loginpageform/true?">
        <input type="hidden" name="t:formdata" value="FD_OPAC_LOGIN" />
        <input id="textfield" name="textfield" type="text" value="" />
        <input id="textfield_0" name="textfield_0" type="text" value="" />
        <input id="hidden" name="hidden" type="hidden" value="SYMWS" />
        <input id="j_username" name="j_username" type="text" />
        <input id="j_password" name="j_password" type="password" />
        <input id="submit_0" name="submit_0" type="submit" value="登入" />
      </form>
    </div>
  `;

  const unauthAcct = parseOpacAccount(loginHtml);
  assert.equal(unauthAcct.loginRequired, true);
  assert.equal(unauthAcct.status, "UNAUTHENTICATED");

  const form = parseOpacLoginForm(loginHtml);
  assert.equal(
    form.actionPath,
    "/client/zh_TW/NUTC/search/mylists.template.patronloginform.loginpageform/true?",
  );
  assert.equal(form.formData, "FD_OPAC_LOGIN");
  assert.equal(form.callbackField, "textfield");
  assert.equal(form.openTabField, "textfield_0");
  assert.equal(form.hiddenVal, "SYMWS");
  assert.equal(form.zoneId, "loginFormZone");
  assert.equal(form.submitName, "submit_0");
  assert.equal(form.submitClientId, "submit_0");
});

test("parseLibraryPortalLinks ignores commented-out maintain.html and resolves decryptuid2.jsp", () => {
  const html = `
    <!-- <a href="maintain.html">館藏查詢、圖書預約、個人借閱查詢</a> -->
    <a href="http://lib1.nutc.edu.tw:8080/ntit/decryptuid2.jsp?user_id=586159">館藏查詢、圖書預約、個人借閱查詢</a>
  `;
  const links = parseLibraryPortalLinks(html, "https://library.nutc.edu.tw/sso/default2.aspx");
  assert.equal(
    links.opac,
    "http://lib1.nutc.edu.tw:8080/ntit/decryptuid2.jsp?user_id=586159",
  );
});
