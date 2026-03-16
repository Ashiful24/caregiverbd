import { ReactNode } from "react";

// Props for Table
interface TableProps {
  children: ReactNode; // Table content (thead, tbody, etc.)
  className?: string; // Optional className for styling
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode; // Header row(s)
  className?: string; // Optional className for styling
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode; // Body row(s)
  className?: string; // Optional className for styling
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode; // Cells (th or td)
  className?: string; // Optional className for styling
}

// Props for TableCell
interface TableCellProps {
  children: ReactNode; // Cell content
  isHeader?: boolean; // If true, renders as <th>, otherwise <td>
  className?: string; // Optional className for styling
  title?: string; // Optional title (e.g. for tooltip / truncation)
}

// Table Component - w-full + table-fixed so columns use full width and don't bunch left
const Table: React.FC<TableProps> = ({ children, className }) => {
  return <table className={`w-full min-w-full table-fixed ${className}`}>{children}</table>;
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className }) => {
  return <thead className={className}>{children}</thead>;
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className }) => {
  return <tbody className={className}>{children}</tbody>;
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className }) => {
  return <tr className={className}>{children}</tr>;
};

// TableCell Component - default horizontal padding so content doesn't sit flush left
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className,
  title,
}) => {
  const CellTag = isHeader ? "th" : "td";
  return <CellTag className={`pl-6 pr-5 ${className ?? ""}`} title={title}>{children}</CellTag>;
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
