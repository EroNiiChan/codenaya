"use client";

import { usePaginatedQuery } from "convex/react";
import { format, formatDistanceToNow } from "date-fns";
import { HistoryIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { api } from "../../../../convex/_generated/api";

const PAGE_SIZE = 20;

/** Every admin change, newest first. */
export const AuditLogCard = () => {
  const { results, status, loadMore } = usePaginatedQuery(
    api.platformModels.listAudit,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  const renderBody = () => {
    if (status === "LoadingFirstPage") {
      return (
        <div className="space-y-2" aria-label="Loading audit log">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    }
    if (results.length === 0) {
      return (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>No changes yet</EmptyTitle>
            <EmptyDescription>Saved admin changes show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return (
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28 sm:w-36">When</TableHead>
            <TableHead className="hidden w-48 md:table-cell">Who</TableHead>
            <TableHead className="hidden w-40 sm:table-cell">Action</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((entry) => (
            <TableRow key={entry._id} className="align-top">
              <TableCell className="text-xs text-muted-foreground">
                <time dateTime={new Date(entry.at).toISOString()} title={format(entry.at, "PPpp")}>
                  {formatDistanceToNow(entry.at, { addSuffix: true })}
                </time>
              </TableCell>
              <TableCell className="hidden truncate text-xs md:table-cell">{entry.actorEmail}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className="font-mono">
                  {entry.action}
                </Badge>
              </TableCell>
              <TableCell className="text-xs break-words whitespace-normal">{entry.summary}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Who changed what, written with every save.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderBody()}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMore(PAGE_SIZE)}
              disabled={status === "LoadingMore"}
            >
              {status === "LoadingMore" && <Spinner />}
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
