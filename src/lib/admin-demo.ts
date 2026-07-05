export const qaSampleGroups = [
  {
    title: "标准问法",
    description: "覆盖高频条文查询、版本确认与条款定位问题。",
    count: 24,
    owner: "规范产品",
  },
  {
    title: "复杂追问",
    description: "覆盖多轮追问、条件补充与跨规范比较。",
    count: 17,
    owner: "知识工程",
  },
  {
    title: "拒答 / 证据不足",
    description: "覆盖无引用、无结论与版本不明场景。",
    count: 11,
    owner: "质量运营",
  },
] as const;

export const evalSuites = [
  { name: "条文查找基线集", count: 18, score: "92%", status: "已达标", lastRun: "今天 09:40" },
  { name: "多规范推理集", count: 14, score: "81%", status: "需优化", lastRun: "今天 09:43" },
  { name: "无答案兜底集", count: 9, score: "89%", status: "已达标", lastRun: "昨天 18:10" },
] as const;

export const feedbackItems = [
  { title: "消防车道宽度比较回答过于笼统", source: "用户反馈", time: "今天 10:24", severity: "高", status: "待处理" },
  { title: "住宅厨房通风回答缺少版本提示", source: "评测回归", time: "今天 09:10", severity: "中", status: "待复核" },
  { title: "深度检索耗时超过 30 秒", source: "性能监控", time: "昨天 18:42", severity: "中", status: "处理中" },
] as const;

export const agentConfigs = [
  {
    title: "普通模式工作流",
    description: "当前指向内部知识库快速检索流程，用于常规条文查询。",
    status: "已接入",
  },
  {
    title: "深度模式工作流",
    description: "当前指向内部知识库深度检索流程，用于多规范推理与复杂问答。",
    status: "已接入",
  },
  {
    title: "RAG 审计位",
    description: "预留召回样本、重排差异、无引用率与版本缺失率展示区域。",
    status: "待补数据",
  },
] as const;

export const qualityMetrics = [
  { label: "无引用率", value: "6.8%" },
  { label: "版本缺失率", value: "9.3%" },
  { label: "深度模式 P95", value: "24.6s" },
  { label: "有帮助反馈率", value: "82%" },
] as const;

export const auditMetrics = [
  { label: "多路召回命中率", value: "88%" },
  { label: "重排后首条命中率", value: "79%" },
  { label: "引用字段完整率", value: "91%" },
  { label: "页码可定位率", value: "74%" },
] as const;

export const auditItems = [
  {
    title: "住宅设计规范",
    issue: "部分回答缺少条款号，仅返回规范名称与摘要片段。",
    severity: "中",
    action: "优先补齐知识库返回字段映射，确保 clause 写入 citations。",
  },
  {
    title: "建筑设计防火规范",
    issue: "深度模式偶发多条引用版本不一致，存在人工复核风险。",
    severity: "高",
    action: "补版本冲突标记逻辑，并在答案中显著提示版本差异。",
  },
  {
    title: "住宅建筑规范",
    issue: "已能定位页码，但尚未支持段落级锚点与高亮。",
    severity: "中",
    action: "后续推动知识库返回 paragraphId / anchor 信息。",
  },
] as const;
