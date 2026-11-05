/**
 * Fails the run when any test recorded a `page-issue` annotation, including tests that are expected to fail for a
 * known defect: `test.fail()` absorbs the fixture error, the annotation stays in the test result.
 *
 * Implemented as a reporter so the other reporters still write their complete results before the status changes.
 */
export default class PageIssuesReporter {
  #recorded = [];

  onTestEnd(test, result) {
    const issues = result.annotations.filter((a) => a.type === 'page-issue').map((a) => JSON.parse(a.description));

    if (issues.length > 0) {
      this.#recorded.push({ project: test.parent.project()?.name, test: test.titlePath(), issues });
    }
  }

  onEnd() {
    if (this.#recorded.length === 0) {
      return undefined;
    }

    process.stderr.write(`\nBrowser page issues were recorded:\n${this.#recorded.map((e) => JSON.stringify(e)).join('\n')}\n`);

    return { status: 'failed' };
  }

  printsToStdio() {
    return false;
  }
}
