type StandardDocument = {
  documentIds?: string[];
  aliases: string[];
  filename: string;
  pageHints?: Array<{ pattern: RegExp; page: number }>;
};

export type RelatedStandardDocument = {
  title: string;
  code: string;
  sourceUrl: string;
};

const documents: StandardDocument[] = [
  {
    documentIds: ["7657903623058030618"],
    aliases: ["GB503682005", "住宅建筑规范"],
    filename: "GB 50368-2005 住宅建筑规范.pdf",
    pageHints: [
      { pattern: /(?:^|\D)2[.,，]0[.,，]10(?:\D|$)|无障碍住房ba/i, page: 10 },
      { pattern: /(?:^|\D)5[.,，]3(?:[.,，]\d+)?(?:\D|$)|无障碍要求/, page: 17 },
    ],
  },
  { aliases: ["CECS3602013", "村镇传统住宅设计规范"], filename: "CECS360-2013 村镇传统住宅设计规范.pdf" },
  { aliases: ["CJJ1292009", "城市快速路设计规程"], filename: "CJJ129-2009 城市快速路设计规程.pdf" },
  { aliases: ["CJJ1692012", "城镇道路路面设计规范"], filename: "CJJ169-2012 城镇道路路面设计规范.pdf" },
  { aliases: ["CJJ1932012", "城市道路路线设计规范"], filename: "CJJ193-2012 城市道路路线设计规范.pdf" },
  { aliases: ["CJJ372012", "城市道路工程设计规范"], filename: "CJJ37-2012 城市道路工程设计规范（2016年版）.pdf" },
  { aliases: ["CJJT852017", "城市绿地分类标准"], filename: "CJJT 85-2017城市绿地分类标准.pdf" },
  { aliases: ["GB500162014", "建筑设计防火规范"], filename: "GB 50016-2014《建筑设计防火规范》.pdf" },
  { aliases: ["GB507362012", "民用建筑供暖通风与空气调节设计规范"], filename: "GB 50736-2012 民用建筑供暖通风与空气调节设计规范.pdf" },
  { aliases: ["GB500342013", "建筑照明设计标准"], filename: "GB50034-2013 建筑照明设计标准.pdf" },
  { aliases: ["GB500962011", "住宅设计规范"], filename: "GB50096-2011 住宅设计规范.pdf" },
  { aliases: ["GB501182010", "民用建筑隔声设计规范"], filename: "GB50118-2010 民用建筑隔声设计规范.pdf" },
  { aliases: ["GB510732014", "医药工业仓储工程设计规范"], filename: "GB51073-2014 医药工业仓储工程设计规范.pdf" },
  { aliases: ["GB511922016", "公园设计规范"], filename: "GB51192-2016 公园设计规范.pdf" },
  { aliases: ["GB550112021", "城市道路交通工程项目规范"], filename: "GB55011-2021城市道路交通工程项目规范（GB 55011-2021）.pdf" },
  { aliases: ["GBT510462014", "国家森林公园设计规范"], filename: "GBT51046-2014 国家森林公园设计规范.pdf" },
  { aliases: ["JGJ1221999", "老年人建筑设计规范"], filename: "JGJ122-1999 老年人建筑设计规范.pdf" },
  { aliases: ["JGJ491988", "综合医院建筑设计规范"], filename: "JGJ49-1988 综合医院建筑设计规范.pdf" },
  { aliases: ["JGJT2622012", "住宅厨房模数协调标准"], filename: "JGJT262-2012 住宅厨房模数协调标准.pdf" },
  { aliases: ["JGJT2632012", "住宅卫生间模数协调标准"], filename: "JGJT263-2012 住宅卫生间模数协调标准.pdf" },
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
