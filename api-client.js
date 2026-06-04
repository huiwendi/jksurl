// ============================================================
// api-client.js - 统一前端 API 客户端（客户 + 库存）
// 用法:
//   1. 在 HTML 中引入此文件
//   2. ApiClient.init('你的AppsScriptURL', 'API_KEY')
//   3. 客户: ApiClient.customer.login(id, pw)
//   4. 库存: ApiClient.inventory.getGroups()
// ============================================================

var ApiClient = (function() {
  'use strict';

  var _url = '';
  var _key = '';

  function init(url, key) {
    _url = url;
    _key = key || 'jksurl-customer-2025';
    if (!url) {
      _url = localStorage.getItem('cs_api_url') || '';
      _key = localStorage.getItem('cs_api_key') || _key;
    }
  }

  function getUrl() { return _url; }
  function getKey() { return _key; }

  // ==================== 客户 API ====================
  var customer = {
    login: async function(id, pw) {
      var params = 'action=login&id=' + encodeURIComponent(id) + '&pw=' + encodeURIComponent(pw);
      var resp = await fetch(_url + '?' + params, { cache: 'no-store' });
      return await resp.json();
    },
    list: async function() {
      var resp = await fetch(_url + '?action=list&key=' + encodeURIComponent(_key) + '&t=' + Date.now(), { cache: 'no-store' });
      return await resp.json();
    },
    add: async function(c) {
      c.action = 'add'; c.key = _key;
      var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(c) });
      return await resp.json();
    },
    update: async function(c) {
      c.action = 'update'; c.key = _key;
      var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(c) });
      return await resp.json();
    },
    remove: async function(id) {
      var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'delete',key:_key,id:id}) });
      return await resp.json();
    }
  };

  // ==================== 库存 API ====================

  /**
   * 获取聚合后的库存（适合前端商品展示）
   * 返回: { success: true, groups: [...] }
   * groups 格式与 index.html 中的 groups 数组完全一致：
   * [{ name, code, image, regDate, options: [{ optName, skuCode, barcode, price, stock, image }] }]
   */
  async function getInventory() {
    var resp = await fetch(_url + '?action=inventory&t=' + Date.now(), { cache: 'no-store' });
    return await resp.json();
  }

  /**
   * 获取原始行数据（管理端用）
   * 返回: { success: true, rows: [{ _row, name, option, barcode, price, stock, ... }] }
   */
  async function getInventoryRows() {
    var resp = await fetch(_url + '?action=inventory_rows&key=' + encodeURIComponent(_key) + '&t=' + Date.now(), { cache: 'no-store' });
    return await resp.json();
  }

  /**
   * 新增库存行
   * @param item { name, option, barcode, price, stock, image, regDate, groupCode, skuCode }
   */
  async function inventoryAdd(item) {
    item.action = 'inventory_add'; item.key = _key;
    var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item) });
    return await resp.json();
  }

  /**
   * 更新库存行
   * @param item { row, name, option, barcode, price, stock, image, regDate, groupCode, skuCode }
   */
  async function inventoryUpdate(item) {
    item.action = 'inventory_update'; item.key = _key;
    var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item) });
    return await resp.json();
  }

  /**
   * 仅更新库存数量
   * @param row 行号
   * @param stock 新库存数
   */
  async function inventoryUpdateStock(row, stock) {
    var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'inventory_update_stock',key:_key,row:row,stock:stock}) });
    return await resp.json();
  }

  /**
   * 切换库存行的启用/停用状态
   * @param row 行号
   */
  async function inventoryToggle(row) {
    var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'inventory_toggle',key:_key,row:row}) });
    return await resp.json();
  }

  /**
   * 删除库存行
   * @param row 行号
   */
  async function inventoryDelete(row) {
    var resp = await fetch(_url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'inventory_delete',key:_key,row:row}) });
    return await resp.json();
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

  return { init: init, getUrl: getUrl, getKey: getKey, customer: customer, inventory: inventory };
})();
