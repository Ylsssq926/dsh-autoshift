// Shared task vocabulary for the conversation classifier and native delegation
// rewriting. Pure text heuristics, zero model calls; explicit route config
// always outranks these starter guesses.
const ENGINEERING = /代码|编程|重构|修复|调试|单元测试|报错|崩溃|函数|脚本|算法|部署|接口|组件|数据库|服务器|前端|后端|爬虫|\b(code|refactor|debug|bug|repository|unit tests?|stack trace|traceback|exception|crash|function|script|algorithm|implement|deploy|api|npm|git|docker|compile|runtime|database|server|frontend|backend|regex|sql)\b/i;
const CREATIVE = /创意|文案|角色扮演|剧本|小说|故事|诗|散文|歌词|\b(creative|copywriting|roleplay|story|screenplay|poem|poetry|lyrics|fiction)\b/i;
const WRITER = /邮件|报告|文章|润色|翻译|总结|摘要|改写|周报|简历|\b(email|report|article|translate|translation|proofread|summari[sz]e|summary|rewrite|blog|newsletter)\b/i;
const RESEARCHER = /调研|调查|查资料|文献|综述|最新进展|评测|对比|\b(research|investigate|sources|survey|literature|benchmark|compare|comparison)\b/i;
const ARCHITECT = /架构|技术方案|系统设计|选型|微服务|设计文档|\b(architecture|system design|design doc|rfc|microservices?)\b/i;
const LONG_HORIZON = /跨文件|大型项目|全仓库|整个项目|\b(multi-file|migration|monorepo|large-scale|codebase|end-to-end)\b/i;
const FILE_PATH = /(?:^|[\s("'`])[\w./\\-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|rb|php|cs|cpp|c|h|sh|sql|vue|svelte|json|ya?ml|toml)\b/i;
const STACK_FRAME = /\bat\s+[\w.$<>]+\s+\([\w./\\-]+:\d+:\d+\)/;

export function engineeringSignal(prompt) {
  return ENGINEERING.test(prompt) || prompt.includes('```') || FILE_PATH.test(prompt)
    || STACK_FRAME.test(prompt) || prompt.includes('Traceback (most recent call last)');
}

export function classifyPrompt(prompt) {
  const engineering = engineeringSignal(prompt);
  const role = engineering ? 'implementer'
    : CREATIVE.test(prompt) ? 'creative'
    : WRITER.test(prompt) ? 'writer'
    : RESEARCHER.test(prompt) ? 'researcher'
    : ARCHITECT.test(prompt) ? 'architect' : 'general';
  return { role, longHorizon: engineering && LONG_HORIZON.test(prompt) };
}

// Delegation prompts are task orders: specific verification roles come first,
// then the same vocabulary as the conversation classifier.
const TASK_ROLES = [
  ['tester', /运行.*测试|测试修复|编写.*测试|\b(run tests|test suite|unit tests|test coverage)\b/i],
  ['reviewer', /审查|复核|\b(review|audit)\b/i],
  ['implementer', ENGINEERING],
  ['creative', CREATIVE],
  ['writer', WRITER],
  ['researcher', RESEARCHER],
  ['architect', ARCHITECT],
];
export function delegationRole(prompt) {
  return TASK_ROLES.find(([, pattern]) => pattern.test(prompt))?.[0] ?? 'general';
}