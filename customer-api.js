// ============================================================
// customer-api.js - 客户系统前端 API 客户端
// 用法:
//   1. 在 HTML 中引入此文件
//   2. 调用 CustomerAPI.init('你的AppsScriptURL', 'API_KEY')
//   3. 调用 CustomerAPI.login(id, pw) 进行登录
//   4. 调用 CustomerAPI.list() 获取客户列表 (需 API_KEY)
// ============================================================

var CustomerAPI = (function() {
  'use strict';

  var _url = '';
  var _key = '';

  function init(url, key) {
    _url = url;
    _key = key || 'jksurl-customer-2025';
    // 自动从 localStorage 读取（如果之前保存过）
    if (!url) {
      _url = localStorage.getItem('cs_api_url') || '';
      _key = localStorage.getItem('cs_api_key') || _key;
    }
  }

  // ============ 登录验证 ============
  // 返回: { success: true, customer: {...} } 或 { success: false, error: '...' }
  async function login(id, password) {
    var params = 'action=login&id=' + encodeURIComponent(id) + '&pw=' + encodeURIComponent(password);
    var resp = await fetch(_url + '?' + params, { cache: 'no-store' });
    return await resp.json();
  }

  // ============ 获取客户列表（管理端） ============
  async function list() {
    var resp = await fetch(_url + '?action=list&key=' + encodeURIComponent(_key) + '&t=' + Date.now(), { cache: 'no-store' });
    return await resp.json();
  }

  // ============ 新增客户（管理端） ============
  async function add(customer) {
    customer.action = 'add';
    customer.key = _key;
    var resp = await fetch(_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    return await resp.json();
  }

  // ============ 更新客户（管理端） ============
  async function update(customer) {
    customer.action = 'update';
    customer.key = _key;
    var resp = await fetch(_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    return await resp.json();
  }

  // ============ 删除客户（管理端） ============
  async function remove(id) {
    var resp = await fetch(_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', key: _key, id: id })
    });
    return await resp.json();
  }

  return { init: init, login: login, list: list, add: add, update: update, remove: remove };
})();
