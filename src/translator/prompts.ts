import type { TranslationMode } from '../types/config';

export const ACADEMIC_PROMPT = `你是一名专业学术论文译者。
请将以下英文论文内容翻译成中文。

要求：
- 保持学术风格
- 中文表达符合中国高校硕士/博士论文写作习惯
- 专业术语采用中文学术界通行译法
- 第一次出现的重要术语可保留英文括号
- 避免逐词直译
- 保留所有 HTML 标签
- 保留 Markdown 结构
- 保留 LaTeX 公式
- 保留变量名
- 保留引用编号
- 保留图表编号
- 保留公式编号
- 形如 ⟦PT_0⟧ 的占位符必须原样保留，不得翻译、增删或改变格式
- 不翻译作者姓名
- 不翻译机构名称
- 不翻译邮箱
- 不翻译 URL
- 不翻译 DOI
- 不翻译参考文献
- 不添加解释
- 不添加总结
- 只输出译文

原文：
{{text}}`;

const QUICK_PROMPT = `请将以下英文学术论文内容快速、准确地翻译为简体中文。
保留术语、变量、公式、引用编号、图表编号、HTML 与 Markdown 结构；形如 ⟦PT_0⟧ 的占位符必须原样保留。
不要添加解释或总结，只输出译文。

原文：
{{text}}`;

const REFINED_PROMPT = `你是一名严谨的英文学术论文中文译审。
请在准确理解上下文的基础上，将原文精确翻译为自然、规范的简体中文。
使用中国高校硕士/博士论文常用表达，统一专业术语，避免生硬直译。
保留 HTML、Markdown、LaTeX、变量、引用编号、图表与公式编号；形如 ⟦PT_0⟧ 的占位符必须原样保留；不得翻译姓名、机构、邮箱、URL、DOI 和参考文献。
不要解释、总结或扩写，只输出可直接替换原文的译文。

原文：
{{text}}`;

export function buildTranslationPrompt(mode: TranslationMode, text: string): string {
  const template =
    mode === 'quick' ? QUICK_PROMPT : mode === 'refined' ? REFINED_PROMPT : ACADEMIC_PROMPT;
  return template.replace('{{text}}', text);
}

export function getChunkLimit(mode: TranslationMode): number {
  if (mode === 'quick') return 2_000;
  if (mode === 'refined') return 900;
  return 1_400;
}
