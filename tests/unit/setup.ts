import { afterEach, beforeEach } from 'vitest';
import './setup-refusals.ts';
import { cpuProblem } from './setup-rules';

/**
 * The unit step's setup (#477): every refusal in setup-refusals.ts, and a
 * test over its CPU limit fails after it. Coverage runs the refusals alone,
 * since a coverage run carries no per-test limit (global rule; #728).
 */
let started = process.threadCpuUsage();
beforeEach(() => {
  started = process.threadCpuUsage();
});
afterEach((context) => {
  const used = process.threadCpuUsage(started);
  const problem = cpuProblem(
    `${context.task.file.name} > ${context.task.name}`,
    used.user + used.system,
  );
  if (problem !== null) throw new Error(problem);
});
