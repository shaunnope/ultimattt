// App-wide types. Shallow routes (pushState) carry this state: help opens over the current screen with `help: true`.
declare global {
  namespace App {
    interface PageState {
      help?: boolean;
    }
  }
}

export {};
