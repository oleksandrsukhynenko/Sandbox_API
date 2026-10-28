import type { FullConfig, Reporter, Suite, TestCase } from '@playwright/test/reporter';

export default class OutcomeReporter implements Reporter {
  private tests: TestCase[] = [];

  /** Records discovered cases so retries are counted once per test, not per attempt. */
  onBegin(_config: FullConfig, suite: Suite) {
    this.tests = suite.allTests();
  }

  /** Separates expected failures and skipped cases from successful checks for each project. */
  onEnd() {
    const projects = new Set(this.tests.map(test => test.parent.project()?.name ?? 'default'));
    console.log('\nOutcome summary (expected failures are not counted as passed checks):');
    for (const project of projects) {
      const counts = { passed: 0, expectedFailures: 0, skipped: 0, flaky: 0, failed: 0 };
      for (const test of this.tests.filter(test => (test.parent.project()?.name ?? 'default') === project)) {
        const outcome = test.outcome();
        if (outcome === 'skipped') {
          counts.skipped++;
          //else if several times looks strange
        } else if (outcome === 'unexpected') {
          counts.failed++;
        } else if (outcome === 'flaky') {
          counts.flaky++;
        } else if (test.expectedStatus === 'failed') {
          counts.expectedFailures++;
        } else {
          counts.passed++;
        }
      }
      const label = project === 'known-issues' ? 'known-issue checks' : 'checks';
      console.log(`[${project}] ${counts.passed} passed ${label}; ${counts.expectedFailures} expected failures; ${counts.skipped} skipped; ${counts.flaky} flaky; ${counts.failed} unexpected failures`);
    }
  }
}