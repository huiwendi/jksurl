// ============================================================
// matching.js - ezadmin「매칭 일괄등록」표 생성 (match_list)
// ------------------------------------------------------------
// 为什么需要这个：
//   ezadmin 은 「URL주문서」판매처 상품을 자동 매칭하지 못해서,
//   매칭 표를 만들어 手動 업로드해야 한다.
//   매칭은 【판매처 옵션】 문자열로 이루어지는데, ezadmin 은 매칭할 때
//   "처리된(=전각 문자를 반각으로 바꾼)" 옵션 문자열을 쓴다.
//     예) 22호（10개입）  →  22호(10개입)     ← 이걸로 매칭됨
//         6／0호          →  6/0호
//         A＋B            →  A+B
//   그래서 표를 만들 때 NFKC 정규화를 반드시 적용한다.
//   (2026-11-09 사장님이 手動 업로드하며 발견한 케이스)
//
// 표 형식 (매칭_일괄등록_샘플_v3.xls 와 동일, 시트명 match_list):
//   판매처명 | 판매처 상품코드 | 판매처 옵션 | 상품코드 | 수량 | 판매처 상품명
//   URL주문서 |  S01110        | 레드야광3D눈-1g(20개입) | S01110 | 1 | 주선코리아 ...
// ============================================================
var Matching = (function () {
  'use strict';

  var SELLER = 'URL주문서';
  var HEAD = ['판매처명', '판매처 상품코드', '판매처 옵션', '상품코드', '수량', '판매처 상품명'];
  var NO_OPTION = '(옵션없음)';
  // 매칭 취소용 더미 상품 — 절대 매칭표에 넣으면 안 됨
  var EXCLUDE_GROUP = '- 매칭 취소';

  // ezadmin 이 매칭에 쓰는(=처리된) 옵션 문자열로 변환
  function normOpt(s) {
    var t = String(s == null ? '' : s);
    if (t === NO_OPTION) return '';
    if (t.normalize) t = t.normalize('NFKC');   // 전각 괄호/슬래시/플러스 → 반각
    t = t.replace(/[\u00a0\u200b\u3000\ufeff]/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function nfkc(s) { return String(s == null ? '' : s).normalize ? String(s).normalize('NFKC') : String(s); }

  function pushRow(out, seen, code, opt, name, stat) {
    code = String(code == null ? '' : code).trim();
    if (!code) { stat.noCode++; return; }
    var o = normOpt(opt);
    if (!o) { stat.noOpt++; return; }
    var key = code + '|' + o;
    if (seen[key]) { stat.dup++; return; }
    seen[key] = 1;
    out.push([SELLER, code, o, code, 1, String(name == null ? '' : name).trim()]);
  }

  // 주문 품목(items) → 매칭 행. items: {name, optName, skuCode, qty}
  function rowsFromItems(items) {
    var out = [], seen = {}, stat = { noCode: 0, noOpt: 0, dup: 0 };
    (items || []).forEach(function (it) {
      if (!it) return;
      pushRow(out, seen, it.skuCode, it.optName, it.name, stat);
    });
    return { rows: out, skipped: stat };
  }

  // 재고 API(groups) → 전체 카탈로그 매칭 행
  function rowsFromCatalog(groups) {
    var out = [], seen = {}, stat = { noCode: 0, noOpt: 0, dup: 0, excludedGroups: 0 };
    (groups || []).forEach(function (g) {
      if (!g) return;
      var gname = String(g.name == null ? '' : g.name).trim();
      if (gname === EXCLUDE_GROUP) { stat.excludedGroups++; return; }
      (g.options || []).forEach(function (o) {
        if (!o) return;
        pushRow(out, seen, o.skuCode, o.optName, gname, stat);
      });
    });
    return { rows: out, skipped: stat };
  }

  function todayStamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  function toWorkbook(rows) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX 라이브러리를 불러오지 못했습니다');
    var ws = XLSX.utils.aoa_to_sheet([HEAD].concat(rows));
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 38 }, { wch: 16 }, { wch: 8 }, { wch: 64 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'match_list');
    return wb;
  }

  // rows → .xls(BIFF8) 다운로드. ezadmin 은 .xls 를 요구한다.
  function download(rows, filename) {
    var wb = toWorkbook(rows);
    XLSX.writeFile(wb, filename, { bookType: 'biff8' });
  }

  function fileNameFor(orderNo) {
    var tag = orderNo ? String(orderNo) : ('전체_' + todayStamp());
    return '매칭_' + tag + '.xls';
  }

  return {
    SELLER: SELLER,
    HEAD: HEAD,
    normOpt: normOpt,
    nfkc: nfkc,
    rowsFromItems: rowsFromItems,
    rowsFromCatalog: rowsFromCatalog,
    toWorkbook: toWorkbook,
    download: download,
    fileNameFor: fileNameFor
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Matching;
