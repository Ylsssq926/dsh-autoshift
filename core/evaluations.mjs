// Public evaluation references are capability evidence, not universal rankings.
export const EVALUATION_SOURCES = [
  {
    id: 'swe-bench', url: 'https://www.swebench.com/',
    dimensions: ['repositoryNavigation', 'multiFileConsistency', 'patchPrecision', 'failureRecovery'],
    scope: 'software-engineering issue resolution',
    caveat: 'benchmark harness and repository distribution affect results; not general chat quality',
  },
  {
    id: 'bfcl', url: 'https://gorilla.cs.berkeley.edu/leaderboard.html',
    dimensions: ['functionCalling', 'parallelToolCalling', 'structuredOutput'],
    scope: 'function calling and agentic tool use',
    caveat: 'function schema, mode and benchmark version matter; cost and latency are estimated benchmark values',
  },
  {
    id: 'live-code-bench', url: 'https://github.com/LiveCodeBench/LiveCodeBench',
    dimensions: ['coding', 'debugging', 'failureRecovery', 'testDesign'],
    scope: 'contamination-aware code generation, repair, execution and test prediction',
    caveat: 'release window and scenario must be recorded; pass@1 is not repository engineering reliability',
  },
  {
    id: 'metr-time-horizon', url: 'https://metr.org/time-horizons/',
    dimensions: ['largeProjectExecution', 'failureRecovery'],
    scope: 'human-time-scaled software task completion',
    caveat: 'methodology measures agent task horizon and is not a direct per-model DSH score',
  },
  {
    id: 'ruler', url: 'https://github.com/NVIDIA/RULER',
    dimensions: ['longContextRetrieval', 'longContextReasoning', 'constraintRetention'],
    scope: 'effective long-context capability across retrieval and reasoning tasks',
    caveat: 'synthetic tasks do not replace real project context tests; claimed context length is not effective context',
  },
  {
    id: 'eq-bench-creative-writing', url: 'https://eqbench.com/creative_writing.html',
    dimensions: ['creativeGeneration', 'writing', 'styleControl', 'repetitionControl'],
    scope: 'LLM-judged creative writing quality and style metrics',
    caveat: 'judge model, prompt, language and rubric affect scores; use as a creative signal only',
  },
];

export function evaluationSource(id) {
  return EVALUATION_SOURCES.find((source) => source.id === id);
}
