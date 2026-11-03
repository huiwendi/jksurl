// ============================================================
// api-client.js - 统一前端 API 客户端（客户 + 库存 + 订单邮件 + 管理员）
// 用法:
//   1. HTML 中引入 config.js (定义 CONFIG) 与本文件
//   2. ApiClient.init()
//   3. 客户登录: ApiClient.customer.login(id, pw) -> { success, customer, session }
//   4. 订单邮件: ApiClient.order.nextNo() / ApiClient.order.send(payload)
//   5. 库存: ApiClient.inventory.getGroups()
//   6. 管理员: ApiClient.admin.login(id, pw) -> 令牌自动保存
//
// 说明: POST 使用 text/plain 提交 JSON 字符串。
//   Google Apps Script 的 CORS 不支持 application/json 预检请求，
//   用 text/plain 可避免 preflight，后端仍按 JSON 解析 body。
// ============================================================

var ApiClient = (function() {
  'use strict';

  var URL_EXEC = 'https://script.google.com/macros/s/AKfycbyJ65PS1DQCc0C5wL892I3juYPtInlMi1mltmgmMHbOhAChkqUvIc7Y-mx7wvhr9Voq/exec';

  var _url = '';
  var _key = '';
  var _token = (function() { try { return sessionStorage.getItem('admin_token') || ''; } catch(e) { return ''; } })();
  var _session = (function() { try { return sessionStorage.getItem('order_session') || ''; } catch(e) { return ''; } })();

  function init(url, key) {
    if (!url && typeof CONFIG !== 'undefined') { url = CONFIG.API_URL || ''; key = CONFIG.API_KEY || key; }
    _url = url || URL_EXEC;
    _key = key || 'jksurl-customer-2025';
  }

  function getUrl() { return _url; }
  function getKey() { return _key; }

  // 서버가 HTML 오류 페이지 등 비 JSON 응답을 반환할 때 방어
  async function safeJson(resp) {
    var text;
    try { text = await resp.text(); }
    catch(e) { return { success: false, error: '서버 응답을 읽을 수 없습니다' }; }
    try { return JSON.parse(text); }
    catch(e) {
      var msg = text.length > 100 ? text.slice(0, 100) + '...' : text;
      return { success: false, error: '서버 응답 오류 (HTTP ' + resp.status + '): ' + msg, _parseError: true };
    }
  }

  // text/plain POST (preflight 회피)
  async function post(body, opts) {
    var resp = await fetch(_url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      cache: 'no-store'
    });
    return await safeJson(resp);
  }

  function setToken(t) {
    _token = t || '';
    try { if (t) sessionStorage.setItem('admin_token', t); else sessionStorage.removeItem('admin_token'); } catch(e) {}
  }
  function getToken() { return _token; }

  function setSession(s) {
    _session = s || '';
    try { if (s) sessionStorage.setItem('order_session', s); else sessionStorage.removeItem('order_session'); } catch(e) {}
  }
  function getSession() { return _session; }

  // 관리자 요청용 보조
  function adminBody(o) {
    var copy = Object.assign({}, o);
    copy.key = _key;
    if (_token) copy.token = _token;
    return copy;
  }
  function adminQuery() {
    var q = 'key=' + encodeURIComponent(_key);
    if (_token) q += '&token=' + encodeURIComponent(_token);
    return q;
  }

  // ==================== 客户 API ====================
  var customer = {
    // 로그인: POST 우선 (신형), 실패 시 구형 GET 폴백 (구버전 백엔드 호환)
    login: async function(id, pw) {
      var data = null;
      try {
        data = await post({ action: 'login', id: id, pw: pw });
      } catch(e) {
        data = { success: false, error: String((e && e.message) || e) };
      }

      if (!data || !data.success) {
        var needFallback = !data || data._parseError || /unknown action|잘못된 요청|서버 응답 오류|Failed to fetch/i.test(String(data.error || ''));
        if (needFallback) {
          try {
            var resp = await fetch(_url + '?action=login&id=' + encodeURIComponent(id) + '&pw=' + encodeURIComponent(pw), { cache: 'no-store' });
            data = await safeJson(resp);
          } catch(e2) { /* keep original error */ }
        }
      }

      if (data && data.success) {
        if (data.session) setSession(data.session);
        if (data.customer && !data.customer.id) data.customer.id = id;
      }
      return data;
    },
    logout: function() {
      setSession('');
      try { sessionStorage.removeItem('customer'); } catch(e) {}
    },
    list: async function() {
      var resp = await fetch(_url + '?action=list&' + adminQuery() + '&t=' + Date.now(), { cache: 'no-store' });
      return await safeJson(resp);
    },
    add: async function(c) {
      c.action = 'add';
      return await post(adminBody(c));
    },
    update: async function(c) {
      c.action = 'update';
      return await post(adminBody(c));
    },
    remove: async function(id) {
      return await post(adminBody({ action: 'delete', id: id }));
    }
  };

  // ==================== 订单邮件 API ====================
  var order = {
    // 수신자 인원수 등 공개 정보
    info: async function() {
      var resp = await fetch(_url + '?action=order_config&t=' + Date.now(), { cache: 'no-store' });
      return await safeJson(resp);
    },
    // 서버에서 순번 주문번호 발급: JKS-20261103-007
    nextNo: async function() {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_no', session: _session });
    },
    // 주문서 이메일 발송
    // payload: { orderNo, customer:{name,phone,mobile,zip,address,memo}, items:[...], file:{name,b64}, resend }
    send: async function(payload) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      var body = Object.assign({ action: 'order_send', session: _session }, payload);
      return await post(body);
    },
    // 초안 저장 (메일 발송 없음)
    save: async function(payload) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post(Object.assign({ action: 'order_create', session: _session }, payload));
    },
    // 내 주문 목록
    list: async function() {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_list', session: _session });
    },
    detail: async function(orderNo) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_detail', session: _session, orderNo: orderNo });
    },
    beginEdit: async function(orderNo) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_begin_edit', session: _session, orderNo: orderNo });
    },
    abortEdit: async function(orderNo) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_abort_edit', session: _session, orderNo: orderNo });
    },
    cancel: async function(orderNo) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_cancel', session: _session, orderNo: orderNo });
    },
    remove: async function(orderNo) {
      if (!_session) return { success: false, code: 'NO_SESSION', error: '로그인 세션이 없습니다. 다시 로그인해주세요.' };
      return await post({ action: 'order_delete', session: _session, orderNo: orderNo });
    }
  };

  // ==================== 관리자 API ====================
  var admin = {
    login: async function(id, pw) {
      var data = await post({ action: 'admin_login', id: id, pw: pw });
      if (data && data.success && data.token) setToken(data.token);
      return data;
    },
    accessCheck: async function(pw) {
      return await post({ action: 'access_check', key: _key, pw: pw });
    },
    // 주문 메일 설정
    mailGet: async function() {
      return await post(adminBody({ action: 'mail_settings_get' }));
    },
    mailSet: async function(recipients, fromName, subjectTpl) {
      return await post(adminBody({
        action: 'mail_settings_set',
        recipients: recipients,
        fromName: fromName,
        subjectTpl: subjectTpl
      }));
    },
    // 주문 관리
    orders: async function() {
      return await post(adminBody({ action: 'admin_orders_list' }));
    },
    setOrderStatus: async function(orderNo, status) {
      return await post(adminBody({ action: 'admin_order_status', orderNo: orderNo, status: status }));
    }
  };

  // ==================== 库存 API ====================
  async function getInventory() {
    var resp = await fetch(_url + '?action=inventory&t=' + Date.now(), { cache: 'no-store' });
    return await safeJson(resp);
  }

  async function getInventoryRows() {
    var resp = await fetch(_url + '?action=inventory_rows&' + adminQuery() + '&t=' + Date.now(), { cache: 'no-store' });
    return await safeJson(resp);
  }

  async function inventoryAdd(item) {
    item.action = 'inventory_add';
    return await post(adminBody(item));
  }

  async function inventoryUpdate(item) {
    item.action = 'inventory_update';
    return await post(adminBody(item));
  }

  async function inventoryUpdateStock(row, stock) {
    return await post(adminBody({ action: 'inventory_update_stock', row: row, stock: stock }));
  }

  async function inventoryToggle(row) {
    return await post(adminBody({ action: 'inventory_toggle', row: row }));
  }

  async function inventoryDelete(row) {
    return await post(adminBody({ action: 'inventory_delete', row: row }));
  }

  var inventory = {
    getGroups: getInventory,
    getRows: getInventoryRows,
    add: inventoryAdd,
    update: inventoryUpdate,
    updateStock: inventoryUpdateStock,
    toggle: inventoryToggle,
    delete: inventoryDelete
  };

  return {
    init: init, getUrl: getUrl, getKey: getKey,
    setToken: setToken, getToken: getToken,
    setSession: setSession, getSession: getSession,
    customer: customer, order: order, admin: admin, inventory: inventory
  };
})();
