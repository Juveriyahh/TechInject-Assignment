'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Checkbox } from './checkbox';
import { cn } from '../lib/cn';

export interface DataTableColumn<TRow> {
  /** Stable column identifier, also used as the React key. */
  id: string;
  /** Column heading. */
  header: React.ReactNode;
  /** Cell renderer for the given row. */
  cell: (row: TRow) => React.ReactNode;
  /** Horizontal alignment of both header and cells. */
  align?: 'left' | 'right' | 'center';
  /** Extra classes applied to the header and cells of this column. */
  className?: string;
  /** Keeps the column pinned while the table scrolls horizontally. */
  sticky?: boolean;
}

export interface DataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: ReadonlyArray<TRow>;
  /** Extracts a stable key per row. */
  getRowId: (row: TRow) => string;
  /** Currently selected row ids; pair with `onSelectionChange` to enable checkboxes. */
  selectedRowIds?: ReadonlySet<string>;
  onSelectionChange?: (selectedRowIds: ReadonlySet<string>) => void;
  /** Trailing per-row action cell, rendered in a right-aligned column. */
  renderRowActions?: (row: TRow) => React.ReactNode;
  /** Shown instead of the body when `rows` is empty. */
  emptyState?: React.ReactNode;
  className?: string;
  /** Accessible caption describing the table contents. */
  caption?: string;
  /** Summary cells rendered in the sticky footer strip. */
  summary?: ReadonlyArray<TableSummaryItem>;
}

const alignClasses = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center'
} as const;

export interface TableSummaryItem {
  label: string;
  value?: React.ReactNode;
  /** Renders the label as a muted "add" affordance instead of a metric. */
  placeholder?: boolean;
}

/** Footer strip of aggregate cells, as CRM tables show below the last row. */
export function TableSummaryBar({
  items,
  className
}: {
  items: ReadonlyArray<TableSummaryItem>;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 border-t border-border md:grid-cols-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 border-r border-border px-4 py-2.5 text-sm last:border-r-0"
        >
          {item.placeholder ? (
            <>
              <Plus aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{item.label}</span>
            </>
          ) : (
            <>
              {item.value !== undefined ? (
                <span className="font-medium tabular-nums text-foreground">{item.value}</span>
              ) : null}
              <span className="truncate text-muted-foreground">{item.label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Dense, hoverable CRM table with optional row selection and action menus. */
export function DataTable<TRow>({
  columns,
  rows,
  getRowId,
  selectedRowIds,
  onSelectionChange,
  renderRowActions,
  emptyState,
  className,
  caption,
  summary
}: DataTableProps<TRow>): React.JSX.Element {
  const selectable = typeof onSelectionChange === 'function';
  const selected = selectedRowIds ?? new Set<string>();
  const selectedCount = rows.filter((row) => selected.has(getRowId(row))).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const columnCount = columns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0);

  const toggleAll = (): void => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set<string>() : new Set(rows.map(getRowId)));
  };

  const toggleRow = (rowId: string): void => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    onSelectionChange(next);
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-border">
              {selectable ? (
                <th scope="col" className="w-10 px-4 py-2.5">
                  <Checkbox
                    aria-label={allSelected ? 'Clear selection' : 'Select all rows'}
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground',
                    alignClasses[column.align ?? 'left'],
                    column.sticky && 'sticky left-0 z-10 bg-card',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
              {renderRowActions ? (
                <th scope="col" className="w-16 px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyState ?? 'No records found.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selected.has(rowId);
                return (
                  <tr
                    key={rowId}
                    data-selected={isSelected ? 'true' : undefined}
                    className={cn(
                      'group border-b border-border/70 transition-colors last:border-b-0',
                      isSelected ? 'bg-selection/[0.06]' : 'hover:bg-elevated/60'
                    )}
                  >
                    {selectable ? (
                      <td className="px-4 py-3">
                        <Checkbox
                          aria-label={`Select ${rowId}`}
                          checked={isSelected}
                          onChange={() => toggleRow(rowId)}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'whitespace-nowrap px-4 py-3 align-middle',
                          alignClasses[column.align ?? 'left'],
                          column.sticky && 'sticky left-0 z-10 bg-card group-hover:bg-elevated/60',
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    {renderRowActions ? <td className="px-4 py-3 text-right">{renderRowActions(row)}</td> : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {summary && summary.length > 0 ? <TableSummaryBar items={summary} /> : null}
    </div>
  );
}
