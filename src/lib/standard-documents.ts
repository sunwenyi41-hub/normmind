type StandardDocument = {
  documentIds?: string[];
  aliases: string[];
  filename: string;
  pageHints?: Array<{ pattern: RegExp; page: number }>;
  category?: "建筑" | "规划" | "景观" | "市政" | "暖通";
  status?: "已发布" | "解析中" | "待补标签";
  updatedAt?: string;
  chunks?: number;
  tags?: string[];
  summary?: string;
};

export type RelatedStandardDocument = {
  title: string;
  code: string;
  sourceUrl: string;
};

export type StandardLibraryDocument = {
  id: string;
  title: string;
  code: string;
  version: string;
  category: "建筑" | "规划" | "景观" | "市政" | "暖通";
  status: "已发布" | "解析中" | "待补标签";
  updatedAt: string;
  chunks: number;
  tags: string[];
  sourceUrl: string;
  summary: string;
};

const documents: StandardDocument[] = [
  {
    documentIds: ["7657903623058030618"],
    aliases: ["GB503682005", "住宅建筑规范"],
    filename: "GB 50368-2005 住宅建筑规范.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-28",
    chunks: 184,
    tags: ["住宅", "无障碍", "建筑设计"],
    summary: "覆盖住宅套型、空间组织、交通联系、无障碍和基本性能要求。",
    pageHints: [
      { pattern: /(?:^|\D)2[.,，]0[.,，]10(?:\D|$)|无障碍住房ba/i, page: 10 },
      { pattern: /(?:^|\D)5[.,，]3(?:[.,，]\d+)?(?:\D|$)|无障碍要求/, page: 17 },
    ],
  },
  {
    aliases: ["CECS3602013", "村镇传统住宅设计规范"],
    filename: "CECS360-2013 村镇传统住宅设计规范.pdf",
    category: "建筑",
    status: "待补标签",
    updatedAt: "2026-06-15",
    chunks: 72,
    tags: ["住宅", "乡村", "传统建筑"],
    summary: "聚焦村镇住宅的风貌延续、空间组织与建造控制。",
  },
  {
    aliases: ["CJJ1292009", "城市快速路设计规程"],
    filename: "CJJ129-2009 城市快速路设计规程.pdf",
    category: "市政",
    status: "已发布",
    updatedAt: "2026-06-12",
    chunks: 96,
    tags: ["道路", "交通", "快速路"],
    summary: "覆盖城市快速路的线形、横断面、交通组织与附属设施要求。",
  },
  {
    aliases: ["CJJ1692012", "城镇道路路面设计规范"],
    filename: "CJJ169-2012 城镇道路路面设计规范.pdf",
    category: "市政",
    status: "已发布",
    updatedAt: "2026-06-11",
    chunks: 88,
    tags: ["道路", "路面", "市政"],
    summary: "用于城镇道路路面结构、材料与耐久设计。",
  },
  {
    aliases: ["CJJ1932012", "城市道路路线设计规范"],
    filename: "CJJ193-2012 城市道路路线设计规范.pdf",
    category: "市政",
    status: "已发布",
    updatedAt: "2026-06-10",
    chunks: 101,
    tags: ["道路", "路线", "市政"],
    summary: "覆盖路线平纵横指标、交叉口和视距等控制要求。",
  },
  {
    aliases: ["CJJ372012", "城市道路工程设计规范"],
    filename: "CJJ37-2012 城市道路工程设计规范（2016年版）.pdf",
    category: "市政",
    status: "已发布",
    updatedAt: "2026-06-09",
    chunks: 135,
    tags: ["道路", "综合工程", "市政"],
    summary: "适用于城市道路工程的综合设计与专业接口控制。",
  },
  {
    aliases: ["CJJT852017", "城市绿地分类标准"],
    filename: "CJJT 85-2017城市绿地分类标准.pdf",
    category: "景观",
    status: "已发布",
    updatedAt: "2026-06-26",
    chunks: 63,
    tags: ["绿地", "景观", "分类"],
    summary: "定义城市绿地体系分类与统计口径，是景观资料库的重要基础标准。",
  },
  {
    aliases: ["GB500162014", "建筑设计防火规范"],
    filename: "GB 50016-2014《建筑设计防火规范》.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-27",
    chunks: 246,
    tags: ["防火", "建筑", "消防"],
    summary: "覆盖防火分区、疏散、消防车道与建筑构造等核心消防要求。",
  },
  {
    aliases: ["GB507362012", "民用建筑供暖通风与空气调节设计规范"],
    filename: "GB 50736-2012 民用建筑供暖通风与空气调节设计规范.pdf",
    category: "暖通",
    status: "已发布",
    updatedAt: "2026-06-24",
    chunks: 212,
    tags: ["暖通", "通风", "空调"],
    summary: "用于民用建筑供暖、通风和空调系统的设计与校核。",
  },
  {
    aliases: ["GB500342013", "建筑照明设计标准"],
    filename: "GB50034-2013 建筑照明设计标准.pdf",
    category: "建筑",
    status: "待补标签",
    updatedAt: "2026-06-08",
    chunks: 57,
    tags: ["照明", "建筑"],
    summary: "面向建筑空间照度、眩光限制与节能控制。",
  },
  {
    aliases: ["GB500962011", "住宅设计规范"],
    filename: "GB50096-2011 住宅设计规范.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-25",
    chunks: 173,
    tags: ["住宅", "通风", "居住空间"],
    summary: "常用于校核住宅户型、通风采光、厨卫与设备布置要求。",
  },
  {
    aliases: ["GB501182010", "民用建筑隔声设计规范"],
    filename: "GB50118-2010 民用建筑隔声设计规范.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-16",
    chunks: 81,
    tags: ["隔声", "建筑"],
    summary: "用于民用建筑房间、构件和设备系统的声环境设计。",
  },
  {
    aliases: ["GB510732014", "医药工业仓储工程设计规范"],
    filename: "GB51073-2014 医药工业仓储工程设计规范.pdf",
    category: "建筑",
    status: "解析中",
    updatedAt: "刚刚",
    chunks: 0,
    tags: ["仓储", "工业建筑"],
    summary: "作为解析流程演示样本，当前仍处于知识片段生成阶段。",
  },
  {
    aliases: ["GB511922016", "公园设计规范"],
    filename: "GB51192-2016 公园设计规范.pdf",
    category: "景观",
    status: "已发布",
    updatedAt: "2026-06-22",
    chunks: 144,
    tags: ["公园", "景观", "游园"],
    summary: "覆盖公园分区、服务设施、景观组织与游憩安全要求。",
  },
  {
    aliases: ["GB550112021", "城市道路交通工程项目规范"],
    filename: "GB55011-2021城市道路交通工程项目规范（GB 55011-2021）.pdf",
    category: "市政",
    status: "已发布",
    updatedAt: "2026-06-21",
    chunks: 118,
    tags: ["道路", "交通", "项目规范"],
    summary: "面向城市道路交通工程的项目底线要求和综合控制指标。",
  },
  {
    aliases: ["GBT510462014", "国家森林公园设计规范"],
    filename: "GBT51046-2014 国家森林公园设计规范.pdf",
    category: "景观",
    status: "待补标签",
    updatedAt: "2026-06-06",
    chunks: 49,
    tags: ["森林公园", "景观"],
    summary: "适用于森林公园游线、设施和生态承载设计。",
  },
  {
    aliases: ["JGJ1221999", "老年人建筑设计规范"],
    filename: "JGJ122-1999 老年人建筑设计规范.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-20",
    chunks: 67,
    tags: ["适老化", "建筑", "无障碍"],
    summary: "用于适老化空间、服务设施与安全细部设计。",
  },
  {
    aliases: ["JGJ491988", "综合医院建筑设计规范"],
    filename: "JGJ49-1988 综合医院建筑设计规范.pdf",
    category: "建筑",
    status: "待补标签",
    updatedAt: "2026-06-05",
    chunks: 54,
    tags: ["医院", "医疗建筑"],
    summary: "适用于综合医院建筑布局和功能流线设计。",
  },
  {
    aliases: ["JGJT2622012", "住宅厨房模数协调标准"],
    filename: "JGJT262-2012 住宅厨房模数协调标准.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-18",
    chunks: 42,
    tags: ["厨房", "住宅", "模数"],
    summary: "用于住宅厨房设备、尺度与模数协调。",
  },
  {
    aliases: ["JGJT2632012", "住宅卫生间模数协调标准"],
    filename: "JGJT263-2012 住宅卫生间模数协调标准.pdf",
    category: "建筑",
    status: "已发布",
    updatedAt: "2026-06-18",
    chunks: 41,
    tags: ["卫生间", "住宅", "模数"],
    summary: "用于住宅卫生间的功能尺寸、设备与模数协调。",
  },
];

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fff]/g, "");
}

export function resolveStandardPdf(input: {
  documentId?: string;
  documentTitle: string;
  version: string | null;
  excerpt: string;
}) {
  const searchable = normalize(`${input.documentTitle} ${input.version ?? ""} ${input.excerpt.slice(0, 300)}`);
  const match = documents.find((document) =>
    document.documentIds?.includes(input.documentId ?? "") ||
    document.aliases.some((alias) => searchable.includes(normalize(alias))),
  );
  if (!match) return undefined;
  const page = match.pageHints?.find((hint) => hint.pattern.test(input.excerpt))?.page;
  const url = `/standards/${encodeURIComponent(match.filename)}`;
  return page ? `${url}#page=${page}&zoom=page-width` : url;
}

export function findRelatedStandardDocuments(text: string): RelatedStandardDocument[] {
  const searchable = normalize(text);
  return documents
    .filter((document) => document.aliases.some((alias) => searchable.includes(normalize(alias))))
    .map((document) => ({
      code: document.aliases.find((alias) => /\d/.test(alias)) ?? "规范文件",
      title: document.aliases.find((alias) => /[\u4e00-\u9fff]/.test(alias)) ?? document.filename.replace(/\.pdf$/i, ""),
      sourceUrl: `/standards/${encodeURIComponent(document.filename)}`,
    }));
}

export function getStandardLibraryDocuments(): StandardLibraryDocument[] {
  return documents.map((document, index) => {
    const code = document.aliases.find((alias) => /\d/.test(alias)) ?? `DOC-${index + 1}`;
    const title = document.aliases.find((alias) => /[\u4e00-\u9fff]/.test(alias)) ?? document.filename.replace(/\.pdf$/i, "");
    const version = code.replace(/([A-Z]+)(\d{2,})/, "$1 $2").replace(/(\d{4})(\d{2,})$/, "$1-$2");

    return {
      id: document.documentIds?.[0] ?? `local-${index + 1}`,
      title,
      code,
      version,
      category: document.category ?? "建筑",
      status: document.status ?? "已发布",
      updatedAt: document.updatedAt ?? "2026-06-01",
      chunks: document.chunks ?? 0,
      tags: document.tags ?? [],
      sourceUrl: `/standards/${encodeURIComponent(document.filename)}`,
      summary: document.summary ?? "规范摘要待补充。",
    };
  });
}

export function getStandardLibraryDocumentById(id: string) {
  return getStandardLibraryDocuments().find((document) => document.id === id);
}
