"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Parsed = { header: string[]; rows: string[][]; numeric: boolean[] };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Parsed };

// Small, trusted CSVs only: plain comma split, no quoted fields.
function parseCsv(text: string): Parsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const [headerLine = "", ...rest] = lines;
  const header = headerLine.split(",").map((c) => c.trim());
  const rows = rest.map((l) => l.split(",").map((c) => c.trim()));
  const numeric = header.map(
    (_, i) =>
      rows.length > 0 &&
      rows.every((r) => r[i] !== undefined && r[i] !== "" && !isNaN(Number(r[i])))
  );
  return { header, rows, numeric };
}

export function DatasetTable({ csvUrl }: { csvUrl: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch(csvUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => setState({ status: "ready", data: parseCsv(text) }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });

    return () => controller.abort();
  }, [csvUrl]);

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full" />;
  }
  if (state.status === "error") {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load the dataset ({state.message}).
      </p>
    );
  }

  const { header, rows, numeric } = state.data;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {header.map((h, i) => (
            <TableHead key={h} className={numeric[i] ? "text-right" : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, r) => (
          <TableRow key={r}>
            {header.map((_, i) => (
              <TableCell
                key={i}
                className={numeric[i] ? "text-right font-mono tabular-nums" : undefined}
              >
                {row[i] ?? ""}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
