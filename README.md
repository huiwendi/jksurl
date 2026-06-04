# 👥 客户 + 📦 库存管理系统（Google Sheets + GitHub Pages）

完全免费！Google Sheets 当数据库，GitHub Pages 当服务器。

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| pi.gs | Google Apps Script 统一后端（客户 + 库存 API） |
| dmin.html | 客户管理页面（增删改查） |
| inventory-admin.html | 库存管理页面（商品增删改查、搜索过滤） |
| pi-client.js | 前端 JS 库 (ApiClient.customer.* / ApiClient.inventory.*) |
| customer-api.js | 旧版客户 API（兼容用） |

## 🚀 部署步骤

### 第一步：Google Sheets + Apps Script（5 分钟）

1. 打开 [Google Sheets](https://sheets.google.com)，**新建空白表格**
2. 菜单：**扩展程序 → Apps Script**
3. 把 pi.gs 的内容**全部复制粘贴**进去
4. 可修改 API_KEY（默认值：jksurl-customer-2025）
5. 保存（Ctrl+S）→ 点右上角 **「部署」→「新部署」**
   - 类型：**网页应用**
   - 执行身份：**我**
   - 访问权限：**所有人**
6. **复制 URL**（类似 https://script.google.com/macros/s/XXXX/exec）
7. 首次运行会弹出权限确认，点 **「允许」**

部署后会自动创建两个 Sheet：
- customers — 客户数据
- inventory — 库存数据

### 第二步：GitHub Pages 部署（3 分钟）

1. GitHub 新建仓库
2. 把 customer-system 文件夹里的所有文件上传到仓库
3. Settings → Pages → Source 选 **main** → Save
4. 1-2 分钟后得到地址：https://你的用户名.github.io/仓库名/

### 第三步：开始使用

| 功能 | 访问地址 |
|------|---------|
| 客户管理 | https://你的用户名.github.io/仓库名/admin.html |
| 库存管理 | https://你的用户名.github.io/仓库名/inventory-admin.html |

打开页面 → 填入 API URL 和 Key → 保存并连接 → 完成！

## 📊 Google Sheets 表结构

### customers（客户表）

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | password | name | phone | mobile | zip | address | memo | code | active |

### inventory（库存表）

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| 商品名 | 选项 | 条码 | 销售价 | 正常库存 | 图片URL | 注册日期 | 代表商品代码 | 商品代码 | 启用 |

## 🔗 接入现有 index.html

让现有的 index.html 从 Google Sheets 读取库存数据：

`html
<!-- 在 <head> 中引入 -->
<script src="customer-system/api-client.js"></script>
<script>
ApiClient.init('https://script.google.com/macros/s/XXXX/exec');

// 替代原有的 autoLoad() 函数
async function loadFromSheets() {
  const data = await ApiClient.inventory.getGroups();
  if (data.success) {
    groups = data.groups;
    filteredGroups = [...groups];
    renderGrid();
  }
}
loadFromSheets();
</script>
`

getGroups() 返回的 JSON 格式和现有代码中 parseData() 生成的 groups 数组**完全一致**，无需改动其他逻辑。

## 💰 费用：0 元

| 服务 | 免费额度 |
|------|---------|
| Google Sheets | 1000 万单元格 |
| Google Apps Script | 每天 2 万次调用 |
| GitHub Pages | 每月 100GB 流量 |
| **合计** | **0 元** |
