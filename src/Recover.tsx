import { Component, type ReactNode } from "react";
import { reportError } from "./errors";

interface State {
  /** The views crashed and wait to start again. */
  broken: boolean;
  /** Crashes so far; the key that remounts the views. */
  failures: number;
}

/** Restarts, at most: a view that keeps crashing is left out. */
const MAX_RESTARTS = 5;

/**
 * Catches a crash of the views below it: the error goes to the log, and the
 * views start again a moment later, instead of a frozen or empty window.
 */
export class Recover extends Component<{ where: string; children: ReactNode }, State> {
  state: State = { broken: false, failures: 0 };
  private retry: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { broken: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, this.props.where);
    if (this.state.failures < MAX_RESTARTS) {
      this.retry = setTimeout(() => this.setState((s) => ({ broken: false, failures: s.failures + 1 })), 500);
    }
  }

  componentWillUnmount() {
    if (this.retry) clearTimeout(this.retry);
  }

  render() {
    if (this.state.broken) return null;
    return (
      <div key={this.state.failures} style={{ display: "contents" }}>
        {this.props.children}
      </div>
    );
  }
}
