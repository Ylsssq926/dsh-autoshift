import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrompt, delegationRole } from './core/task-roles.mjs';

test('writer, researcher and architect prompts get their own roles', () => {
  for (const [prompt, role] of [
    ['帮我写一封邮件给老板', 'writer'],
    ['translate this paragraph into Chinese', 'writer'],
    ['总结这篇文章的要点', 'writer'],
    ['帮我润色简历', 'writer'],
    ['调研一下最新的开源模型进展', 'researcher'],
    ['literature survey on retrieval augmentation', 'researcher'],
    ['对比这两家中转站的价格', 'researcher'],
    ['设计一个微服务架构', 'architect'],
    ['system design for a URL shortener', 'architect'],
    ['给出技术选型建议', 'architect'],
  ]) assert.equal(classifyPrompt(prompt).role, role, prompt);
});

test('engineering outranks every other role', () => {
  for (const prompt of ['修复这个bug并写一份报告', '调研代码库的实现', '帮我写个部署脚本', '这个算法怎么优化', '数据库连接报错', '翻译这段代码注释']) {
    assert.equal(classifyPrompt(prompt).role, 'implementer', prompt);
  }
});

test('creative outranks writer, researcher and architect', () => {
  assert.equal(classifyPrompt('写一个故事').role, 'creative');
  assert.equal(classifyPrompt('写一首关于秋天的诗').role, 'creative');
  assert.equal(classifyPrompt('用对比手法写一篇散文').role, 'creative');
});

test('writer outranks researcher and architect', () => {
  assert.equal(classifyPrompt('写一篇调研报告').role, 'writer');
  assert.equal(classifyPrompt('把架构方案翻译成英文').role, 'writer');
});

test('longHorizon still requires an engineering signal', () => {
  assert.equal(classifyPrompt('重构整个项目').longHorizon, true);
  assert.equal(classifyPrompt('设计整个项目的架构').longHorizon, false);
  assert.equal(classifyPrompt('修复代码').longHorizon, false);
});

test('delegation keeps verification roles first and shares the vocabulary', () => {
  assert.equal(delegationRole('运行测试并报告结果'), 'tester');
  assert.equal(delegationRole('审查这段实现'), 'reviewer');
  assert.equal(delegationRole('写一份报告'), 'writer');
  assert.equal(delegationRole('调研最新进展'), 'researcher');
  assert.equal(delegationRole('设计系统架构'), 'architect');
  assert.equal(delegationRole('随便聊聊'), 'general');
});

test('both classifiers agree on prompts without verification roles', () => {
  for (const prompt of ['修复代码', '写一个故事', '写一封邮件', '调研最新进展', '设计系统架构', '随便聊聊']) {
    assert.equal(delegationRole(prompt), classifyPrompt(prompt).role, prompt);
  }
});