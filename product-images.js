// ============================================================
// product-images.js - 상품 이미지 매핑 (재고 API 공개 데이터 기준)
//   주문 items_json 에는 이미지가 저장되지 않으므로
//   바코드 → 상품코드 → 상품명+옵션 → 상품명(대표이미지) 순서로 재고에서 역조회한다.
//   → 과거 주문도 그대로 이미지 표시 가능 (백엔드/GAS 변경 불필요)
// ============================================================
var ProductImages = (function () {
  var CACHE_KEY = 'jks_img_map_v1';
  var TTL = 6 * 3600 * 1000;
  var _promise = null, _map = null, _groups = null;

  // 옵션 문자열 정규화 (주문서의 "(옵션없음)" 제거 + 공백 정리)
  function normOpt(s) {
    return String(s || '').replace(/^\(옵션없음\)$/, '').replace(/\s+/g, ' ').trim();
  }

  // 600KB 원본 대신 URL 을 배열에 1번만 담고 각 키는 index 로 (sessionStorage 절약)
  function buildMap(groups) {
    var urls = [], idx = {};
    function put(map, key, url) {
      if (!key || !url) return;
      if (!(url in idx)) { idx[url] = urls.length; urls.push(url); }
      map[key] = idx[url];
    }
    var map = { u: urls, b: {}, s: {}, n: {}, no: {} };
    (groups || []).forEach(function (g) {
      var gname = String(g.name || '').trim();
      var gimg = String(g.image || '').trim();
      if (gname && gimg) put(map.n, gname, gimg);
      (g.options || []).forEach(function (o) {
        var img = String(o.image || '').trim() || gimg;
        if (!img) return;
        put(map.b, String(o.barcode || '').trim(), img);
        put(map.s, String(o.skuCode || '').trim(), img);
        var on = normOpt(o.optName);
        if (gname && on) put(map.no, gname + '\u0001' + on, img);
      });
    });
    return map;
  }

  // 이미 재고 목록을 받아온 페이지는 이걸로 바로 재사용 (재요청 없음)
  function prime(groups) {
    _groups = groups || [];
    _map = buildMap(_groups);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map: _map }));
    } catch (e) {}
    _promise = Promise.resolve({ map: _map, groups: _groups, cached: false });
    return { map: _map, groups: _groups, cached: false };
  }

  // { map, groups } — groups 는 실제로 받아온 경우에만 채워진다(캐시 hit 시 null)
  function load() {
    if (_promise) return _promise;
    _promise = (async function () {
      try {
        var raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          var c = JSON.parse(raw);
          if (c && c.ts && c.map && c.map.u && (Date.now() - c.ts) < TTL) {
            _map = c.map;
            return { map: _map, groups: null, cached: true };
          }
        }
      } catch (e) {}
      var res = null;
      try { res = await ApiClient.inventory.getGroups(); } catch (e) {}
      if (res && res.success) {
        _groups = res.groups || [];
        _map = buildMap(_groups);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map: _map }));
        } catch (e) {}
        return { map: _map, groups: _groups, cached: false };
      }
      _map = { u: [], b: {}, s: {}, n: {}, no: {} };
      return { map: _map, groups: null, cached: false };
    })();
    return _promise;
  }

  function urlFor(it, map) {
    map = map || _map;
    if (!map || !map.u) return '';
    function at(i) { return (i == null) ? '' : (map.u[i] || ''); }
    var bc = String((it && it.barcode) || '').trim();
    if (bc && map.b[bc] != null) return at(map.b[bc]);
    var sk = String((it && it.skuCode) || '').trim();
    if (sk && map.s[sk] != null) return at(map.s[sk]);
    var nm = String((it && it.name) || '').trim();
    var op = normOpt(it && it.optName);
    if (nm && op && map.no[nm + '\u0001' + op] != null) return at(map.no[nm + '\u0001' + op]);
    if (nm && map.n[nm] != null) return at(map.n[nm]);
    return '';
  }

  // 마크업:
  //   <a class="it-thumb" data-bc="" data-sku="" data-name="" data-opt="">
  //     <img class="it-img" alt=""><span class="it-ph">📷</span></a>
  // root 생략 시 document 전체. 이미 처리된 노드는 data-img-done 으로 건너뛴다.
  function fill(root, selector) {
    var scope = (typeof root === 'string') ? document.querySelector(root) : (root || document);
    if (!scope) return;
    var thumbs = scope.querySelectorAll(selector || '.it-thumb');
    if (!thumbs.length) return;
    load().then(function (r) {
      Array.prototype.forEach.call(thumbs, function (t) {
        if (t.getAttribute('data-img-done')) return;
        t.setAttribute('data-img-done', '1');
        var url = urlFor({
          barcode: t.getAttribute('data-bc'),
          skuCode: t.getAttribute('data-sku'),
          name: t.getAttribute('data-name'),
          optName: t.getAttribute('data-opt')
        }, r.map);
        if (!url) return;
        var img = t.querySelector('img');
        if (img) {
          img.onload = function () { t.classList.add('ok'); };
          img.onerror = function () { t.classList.remove('ok'); };
          img.src = url;
        }
        t.setAttribute('href', url);
        t.setAttribute('target', '_blank');
        t.setAttribute('rel', 'noopener');
      });
    });
  }

  return { load: load, prime: prime, urlFor: urlFor, normOpt: normOpt, fill: fill };
})();
