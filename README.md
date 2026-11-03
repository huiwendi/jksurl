# JKS 고객 주문 시스템 (GitHub Pages + Google Apps Script)

韩国客户在线选货、下单，订单以 **邮件 + 附件（ezadmin 上传用 .xls）** 的形式
同时发给多位负责人，客户页面显示可复制的订单号。

线上地址：<https://huiwendi.github.io/jksurl/login.html>

---

## 一、页面

| 页面 | 地址 | 说明 |
|------|------|------|
| 客户登录 | `login.html` | 客户账号 + 密码（Google Sheets `customers` 表） |
| 商品选择 / 下单 | `index.html` | 选商品 → 주문서 확인 → **이메일 발송** 或 **저장만 하기**（草稿） |
| 我的订单 | `orders.html` | 草稿 / 已发送 / 修改中 / 处理完成 / 已取消；修改、取消、删除草稿 |
| 一键完成页 | `done.html` | 邮件里的「✅ 처리완료」链接打开此页，**无需登录**点击即完成，可撤销 |
| 客户管理 | `admin.html` | 增删改客户 + 邮件收件人设置 + **订单列表 / 标记处理完成** |
| 库存管理 | `inventory-admin.html` | 商品 / 价格 / 库存维护 |

## 二、下单流程（2026-11 改版后）

```
[直接发送]
客户登录 → 选商品 →「주문서」→ 确认弹窗
   →「📧 주문서 이메일 발송」
       · 后端先建单（상태=작성중，发号 JKS-20261103-007）
       · 前端生成 ezadmin 模板 .xls → 后端给每个负责人各发一封
       · 记录改为 상태=발송됨，写 orders 表
   → 成功页：订单号（一键复制）+ 韩语提示 + 「주문내역」入口

[先存草稿]
   「💾 저장만 하기」→ 建单（작성중，不发邮件）→ 可在「주문내역」里再发送

[修改已发送订单]
「주문내역」→「수정」→ 弹窗：이미 발송된 주문입니다. 수정하시겠습니까?
   → 提示客户先通知我们（可一键复制 안내문）；勾选「담당자에게 알렸습니다」
   → 进入修改（原商品自动带回购物车，可增/删/改数量）
   → 再发送：标题带 (수정 N차)，正文列出 추가/삭제/수량변경，并红字提示
     「이전 주문서는 폐기하세요」

[取消 / 处理完成]
   客户「취소 요청」→ 状态 취소 + 发 [JKS주문-취소] 邮件
   管理页「✅ 처리완료」→ 客户只能看不能改（避免与已上传 ezadmin 的单冲突）
```

订单状态：`작성중`（草稿）→ `발송됨` → `수정중` → `처리완료` / `취소`

- 邮件标题模板：`[JKS주문] {orderNo} / {customerName} / {itemCount}건`
- 发件人显示名：`JKS 주선코리아`
- 收件人：在 `admin.html` →「📧 주문 메일 수신자 설정」维护（默认 3 个）
- 邮件正文：订单号、客户、收件信息、商品明细、合计金额、
  **附件 = ezadmin 주문 업로드用 .xls**（直接上传，不要改名/改内容）
- **附件列顺序（15 列，ezadmin 必需）**：
  `주문번호 | 상품코드/매칭코드 | 주문일 | 상품명 | 옵션 | 바코드 | 단가 | 수량 | 금액 |
   수령자명 | 수령자전화번호 | 수령자핸드폰 | 수령자우편번호 | 수령자주소 | 배송메세지1`
  > `주문일` 是 ezadmin 校验字段（缺了会报“발주서에서 [주문일] 필드를 찾을 수 없습니다”），
  > 写的是 Excel 日期序列号 + 默认日期格式（与旧版导出一致）。
- 失败兜底：邮件发不出去时页面提示错误，仍可点「엑셀만 다운로드」手动处理；
  部分收件人失败时可「다시 발송」

## 三、文件

| 文件 | 说明 |
|------|------|
| `login.html` | 客户登录（POST 登录，session 存 sessionStorage） |
| `index.html` | 商品选择 + 订单确认 + 邮件发送 / 下载 |
| `api-client.js` | 前端 API 客户端（`customer` / `order` / `inventory` / `admin`） |
| `config.js` | 前端配置（API URL + API Key；值为公开信息） |
| `admin.html` | 客户管理 + 邮件收件人设置 |
| `inventory-admin.html` | 库存管理 |
| `customer-api.js` | 旧版客户端（保留，兼容缓存页面） |

> 后端代码 `api.gs` 不在本仓库（单独维护、粘贴到 Google Apps Script）。

## 四、后端接口（api.gs v2026-11-03-orders-3）

公开：

| 请求 | 说明 |
|------|------|
| `GET  ?action=ping` | 版本自检 |
| `GET  ?action=order_config` | 返回收件人数（不暴露地址） |
| `GET  ?action=inventory` | 商品分组数据 |
| `GET  ?action=login&id&pw` | 旧版 GET 登录（兼容） |
| `POST {action:'login'}` | 登录，返回 `customer` + `session` |
| `POST {action:'order_no', session}` | 发放订单号 `JKS-YYYYMMDD-NNN`（旧流程兼容） |
| `POST {action:'order_create', session, ...}` | 保存草稿（발급订单号，状态 작성중，不发邮件） |
| `POST {action:'order_send', session, ...}` | 发送/重发/修改发送（修改时 `(수정 N차)` + 变更明细） |
| `POST {action:'order_list' / 'order_detail', session}` | 我的订单列表 / 详情 |
| `POST {action:'order_begin_edit' / 'order_abort_edit', session}` | 进入/退出修改（발송됨 → 수정중） |
| `POST {action:'order_cancel' / 'order_delete', session}` | 取消订单（发 [JKS주문-취소] 邮件）/ 删除草稿 |
| `POST {action:'order_done', token[, undo]}` | **邮件里的「처리완료」链接**：无需登录，按 token 改状态 |

管理员（`key` + `token`）：`admin_login` / `list` / `add` / `update` / `delete` /
`inventory_*` / `mail_settings_get` / `mail_settings_set` /
**`admin_orders_list` / `admin_order_status`**

### 为什么 POST 用 text/plain

Google Apps Script 不支持 `application/json` 的 CORS 预检（OPTIONS），
所以前端用 `Content-Type: text/plain` 提交 JSON 字符串，后端照常 `JSON.parse`。

## 五、部署 / 更新

1. **后端**：把新版 `api.gs` 粘贴到 Apps Script → 保存 → 运行 `sendTestMail()`
   授权 →「배포 관리 → 편집 → 새 버전」，保持 URL 不变。
2. **前端**：`git push` 到 `huiwendi/jksurl` 的 `master`，GitHub Pages 1 分钟生效。
3. **自检**：打开 `<部署URL>?action=ping`，应返回
   `{"success":true,"version":"2026-11-03-orders-3"}`。

## 六、安全 / 注意

- 订单接口必须带登录 `session`（6 小时），且只发给服务端配置的收件人，
  客户端无法指定收件地址（避免被当发信跳板）。
- 同一 session 每小时最多 10 单；Gmail 免费账号每天 100 封额度（3 人 = 3 封/单）。
- 客户账号密码在 Sheets 中以 `sha256:<salt>:<hash>` 存储，旧密码登录后自动升级。

