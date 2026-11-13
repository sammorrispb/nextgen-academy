import { createRequire } from "node:module";

/**
 * Stand-in for Next's `after()` in pure specs. The real one throws outside a
 * request scope, and it is the thing under test for /api/analytics: the
 * upstream send has to be REGISTERED with the platform, not left as a detached
 * promise that Vercel can freeze the moment the 204 goes out.
 *
 * The stub captures the callback and does not run it. A spec asserts that
 * nothing went upstream when the handler returned, then calls `run()` and
 * asserts the send. A route that sends from a detached promise fails the first
 * half; a route that never registers fails the second.
 */
type AfterTask = () => unknown;

const server = createRequire(`${process.cwd()}/package.json`)("next/server") as {
  after: (task: AfterTask) => void;
};

export class AfterStub {
  tasks: AfterTask[] = [];
  private original: ((task: AfterTask) => void) | null = null;

  install(): void {
    this.tasks = [];
    this.original = server.after;
    server.after = (task: AfterTask) => {
      this.tasks.push(task);
    };
  }

  uninstall(): void {
    if (this.original) server.after = this.original;
    this.original = null;
  }

  /** Run every registered task, in order, the way the platform would. */
  async run(): Promise<void> {
    const pending = this.tasks;
    this.tasks = [];
    for (const task of pending) await task();
  }
}
