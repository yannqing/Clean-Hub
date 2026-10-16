# CleanHub 文档目录说明

本文档用于说明 `docs` 目录的文档分类规则。后续新增文档时，应优先放入对应目录，避免把所有材料混放到 `prd` 或 `trd` 中。

## 目录结构

```text
docs/
  00-overview/              项目级说明、文档指南、索引、通用流程
    templates/              PRD、TRD 等标准文档模板
  01-product/               产品经理负责的产品需求材料
    prd/                    产品总 PRD
    phase-scope/            阶段范围与验收标准
    user-flows/             用户流程、业务流程、页面清单
    permissions/            权限矩阵、角色权限说明
    special-topics/         离线、支付、硬件等产品专题需求
    backlog/                Epic、Feature、User Story 初稿
  02-project-management/    项目经理负责的项目管理材料
    planning/               WBS、里程碑、资源计划、排期
    risks/                  风险、问题、依赖、待确认事项
    meetings/               会议纪要、决策记录
    reports/                周报、状态报告、项目复盘
  03-design/                UI/UX 设计材料
    information-architecture/ 信息架构、导航结构、页面地图
    wireframes/             低保真线框图
    ui-design/              高保真设计、设计系统、组件规范
    prototypes/             可交互原型、用户测试材料
  04-technical/             研发和架构技术材料
    trd/                    技术需求文档或技术方案总览
    architecture/           系统架构、模块边界、ADR
    api/                    API 设计、接口协议、错误码
    database/               数据模型、ERD、迁移说明
    offline/                离线同步技术方案
    payments/               支付、财务、对账技术方案
    hardware/               硬件集成技术方案
    deployment/             部署、环境、CI/CD、运维配置
  05-qa/                    测试与验收材料
    test-plans/             测试策略、测试计划
    test-cases/             功能、权限、支付、离线、硬件测试用例
    uat/                    UAT 用户验收测试用例
    reports/                测试报告、缺陷总结、上线测试结论
  06-delivery/              实施、上线、培训和支持材料
    rollout/                上线计划、灰度计划、回滚方案
    training/               培训手册、培训脚本、操作视频规划
    support/                支持流程、FAQ、工单升级机制
    acceptance/             验收单、签收单、交付清单
  99-archive/               废弃、旧版、临时归档文档
```

## 当前已有文档

| 文档 | 位置 | 用途 |
| ---- | ---- | ---- |
| CleanHub PRD v0.1 | `docs/01-product/prd/Clean_Hub-prd-v0.1.md` | 产品总 PRD |
| Phase 1 范围与验收标准 | `docs/01-product/phase-scope/Clean_Hub-Phase_1范围与验收标准.md` | 第一阶段范围和验收口径 |
| 项目开发流程与文档交付指南 | `docs/00-overview/项目开发流程与文档交付指南.md` | 项目文档体系和开发流程指南 |
| PRD 模板 | `docs/00-overview/templates/PRD模板.md` | 产品需求文档模板 |
| TRD 模板 | `docs/00-overview/templates/TRD模板.md` | 技术需求/技术设计文档模板 |
| Web Admin Phase 1 基础模块 TRD | `docs/04-technical/trd/Clean_Hub-Phase_1-Web_Admin基础模块-TRD-v0.1.md` | Web Admin 基础模块技术方案 |
| Phase 1.2 PDF 对齐补丁（SaaS 租户与账号边界） | `docs/04-technical/trd/Clean_Hub-Phase_1.2-PDF对齐-SaaS租户管理与账号边界补丁-v0.1.md` | 开户、账号边界、**§6.2 订阅详细开发步骤**、P0/P1 改造清单（v0.3） |
| Phase 1.3 武帅杰开发执行计划 | `docs/02-project-management/planning/Clean_Hub-Phase_1.3-武帅杰开发执行计划-v0.1.md` | 武帅杰负责模块、现状缺口、分支策略、开发与验收门禁 |
| Phase 1.3 武帅杰开发验收记录 | `docs/02-project-management/reports/Clean_Hub-Phase_1.3-武帅杰开发验收记录-v0.1.md` | 门店权限与通知配置的开发结果、验证证据和遗留项模板 |
| API Client 使用说明 | `docs/04-technical/api/Clean_Hub-API_Client使用说明.md` | 共享 API Client 的定位、用法和开发约束 |
| Drizzle 数据库迁移操作详解 | `docs/04-technical/database/Clean_Hub-Drizzle数据库迁移操作详解.md` | Drizzle/PostgreSQL migration 概念、命令和团队协作规范 |

## 放置原则

- **产品需求类**放在 `01-product`。
- **项目计划类**放在 `02-project-management`。
- **设计类**放在 `03-design`。
- **技术方案类**放在 `04-technical`。
- **测试验收类**放在 `05-qa`。
- **上线培训支持类**放在 `06-delivery`。
- **旧版或废弃文档**放在 `99-archive`。

> **建议：** 不再使用单独的 `docs/prd` 和 `docs/trd` 平铺目录。PRD 和 TRD 仍然保留为文档类型，但应分别放在 `01-product/prd` 和 `04-technical/trd` 中。
