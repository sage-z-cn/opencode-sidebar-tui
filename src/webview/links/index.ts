import type { Terminal } from "@xterm/xterm";
import { postMessage } from "../shared/vscode-api";

interface Link {
  text: string;
  range: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  decorations: { underline: boolean; pointerCursor: boolean };
  activate: (event: MouseEvent, text: string) => void;
  hover?: (event: MouseEvent, text: string) => void;
  leave?: (event: MouseEvent, text: string) => void;
  dispose?: () => void;
}

const MAX_LINE_LENGTH = 10000;

type ParsedFileReference = {
  readonly path: string;
  readonly line?: number;
  readonly endLine?: number;
  readonly column?: number;
};

type CandidateReference = {
  readonly text: string;
  readonly startIndex: number;
};

const isTokenBoundary = (char: string): boolean =>
  /\s/.test(char) || char === "\"" || char === "'";

const collectCandidateReferences = (
  lineText: string,
): ReadonlyArray<CandidateReference> => {
  const candidates: CandidateReference[] = [];
  let index = 0;

  while (index < lineText.length) {
    while (index < lineText.length && isTokenBoundary(lineText[index] ?? "")) {
      index++;
    }

    const startIndex = index;
    while (index < lineText.length && !isTokenBoundary(lineText[index] ?? "")) {
      index++;
    }

    if (index > startIndex) {
      candidates.push({
        text: lineText.slice(startIndex, index),
        startIndex,
      });
    }
  }

  return candidates;
};

const SINGLE_FILE_RE =
  /^[A-Za-z0-9_.-]+\.(?:c|cc|cpp|cs|css|cts|env|fish|go|h|hpp|html|java|js|json|jsx|kt|lock|lua|md|mjs|mts|php|py|rb|rs|scss|sh|swift|toml|ts|tsx|txt|yaml|yml|zsh)(?::\d+(?::\d+)?)?(?:#L\d+(?:-L?\d+)?)?$/i;

const isLikelyFileReference = (candidate: string): boolean => {
  const withoutAtPrefix = candidate.startsWith("@")
    ? candidate.slice(1)
    : candidate;

  // The first character must be a plausible path-start character to
  // avoid false positives when CJK text is adjacent to a file path
  // without a space separator (e.g. "因为some/path.ts").
  if (!/^[a-zA-Z0-9_\-\.\/\\~]/.test(withoutAtPrefix)) {
    return false;
  }

  // Reject label:path patterns where a non-drive-letter word precedes
  // a slash-containing path (e.g. "Error:src/file.ts", "git:some/branch").
  const colonIdx = withoutAtPrefix.indexOf(":");
  if (colonIdx > 0) {
    const beforeColon = withoutAtPrefix.slice(0, colonIdx);
    const afterColon = withoutAtPrefix.slice(colonIdx + 1);
    if (
      !/^[A-Za-z]$/.test(beforeColon) &&
      !withoutAtPrefix.startsWith("file://") &&
      afterColon.includes("/")
    ) {
      return false;
    }
  }

  return (
    withoutAtPrefix.startsWith("file://") ||
    withoutAtPrefix.startsWith("/") ||
    withoutAtPrefix.startsWith("./") ||
    withoutAtPrefix.startsWith("../") ||
    /^[A-Za-z]:\\/.test(withoutAtPrefix) ||
    SINGLE_FILE_RE.test(withoutAtPrefix) ||
    (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(withoutAtPrefix) &&
      withoutAtPrefix.includes("/"))
  );
};

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const extractHashLineSuffix = (
  reference: string,
): { readonly reference: string; readonly line?: number; readonly endLine?: number } => {
  const match = /^(.*)#L(\d+)(?:-L?(\d+))?$/.exec(reference);
  if (!match) {
    return { reference };
  }

  return {
    reference: match[1] ?? reference,
    line: parsePositiveInteger(match[2]),
    endLine: parsePositiveInteger(match[3]),
  };
};

const extractColonSuffix = (
  reference: string,
): { readonly reference: string; readonly line?: number; readonly column?: number } => {
  const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(reference);
  if (!match) {
    return { reference };
  }

  return {
    reference: match[1] ?? reference,
    line: parsePositiveInteger(match[2]),
    column: parsePositiveInteger(match[3]),
  };
};

const parseFileReference = (candidate: string): ParsedFileReference | null => {
  const withoutAtPrefix = candidate.startsWith("@")
    ? candidate.slice(1)
    : candidate;
  const hashSuffix = extractHashLineSuffix(withoutAtPrefix);
  const colonSuffix = extractColonSuffix(hashSuffix.reference);
  let path = colonSuffix.reference;

  if (!path) {
    return null;
  }

  if (path.startsWith("file://")) {
    try {
      const url = new URL(path);
      path = decodeURIComponent(url.pathname);
      if (url.hostname && !url.pathname.startsWith("/")) {
        path = `${url.hostname}:${path}`;
      }
    } catch {
      return null;
    }
  }

  return {
    path,
    line: hashSuffix.line ?? colonSuffix.line,
    endLine: hashSuffix.endLine,
    column: colonSuffix.column,
  };
};

export function createLinkProvider(terminal: Terminal) {
  return {
    provideLinks(
      bufferLineNumber: number,
      callback: (links: Link[] | undefined) => void,
    ) {
      // xterm.js passes viewport-relative (1-based) bufferLineNumber,
      // but buffer.active.getLine() expects 0-based absolute indices.
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }

      const lineText = line.translateToString(true);

      if (lineText.length > MAX_LINE_LENGTH) {
        callback(undefined);
        return;
      }

      const links: Link[] = [];

      for (const candidate of collectCandidateReferences(lineText)) {
        if (!isLikelyFileReference(candidate.text)) continue;

        const parsedReference = parseFileReference(candidate.text);
        if (!parsedReference) continue;

        links.push({
          text: candidate.text,
          range: {
            start: { x: candidate.startIndex + 1, y: bufferLineNumber },
            end: {
              x: candidate.startIndex + candidate.text.length,
              y: bufferLineNumber,
            },
          },
          decorations: { underline: true, pointerCursor: true },
          activate: (_event: MouseEvent, _text: string) => {
            postMessage({
              type: "openFile",
              path: parsedReference.path,
              line: parsedReference.line,
              endLine: parsedReference.endLine,
              column: parsedReference.column,
            });
          },
        });
      }

      callback(links);
    },
  };
}
