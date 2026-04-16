import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import { Modal } from "../components/ui/modal";
import { ConfirmModal } from "../components/ui/confirm-modal";
import Input from "../components/form/input/InputField";
import TextArea from "../components/form/input/TextArea";
import Label from "../components/form/Label";
import Badge from "../components/ui/badge/Badge";
import {
  consultationTypesApi,
  uploadFileToStorage,
  type ConsultationType,
  type CreateConsultationTypeRequest,
  type UpdateConsultationTypeRequest,
} from "../services/api";
import { resolveConsultationTypeImageUrl } from "../utils/assetUrl";
import { Link } from "react-router";
import {
  AngleRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
} from "../icons";

const TREE_NODE_TYPE = "CONSULTATION_TYPE_TREE_NODE";

/** Employment type options for create/edit (Independent or Salaried). */
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "INDEPENDENT", label: "Independent" },
  { value: "SALARIED", label: "Salaried" },
];

const IMAGE_FILE_INPUT_CLASS =
  "block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-gray-400 dark:file:bg-brand-500/10 dark:file:text-brand-300";

/** Preview for a new file (object URL) or an existing stored image URL. */
function ImagePickPreview({
  previewUrl,
  fileName,
  existingCaption,
}: {
  previewUrl: string | null;
  fileName: string | null;
  /** Shown under the image when showing a saved image and no new file is chosen. */
  existingCaption?: string | null;
}) {
  return (
    <>
      {previewUrl ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
          <img
            src={previewUrl}
            alt=""
            className="mx-auto max-h-48 w-full object-contain"
          />
        </div>
      ) : null}
      {fileName ? (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Selected: {fileName}</p>
      ) : existingCaption && previewUrl ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{existingCaption}</p>
      ) : null}
    </>
  );
}

/** Normalize API response to array of root nodes */
function normalizeTree(
  data: ConsultationType[] | ConsultationType | null | undefined
): ConsultationType[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Flatten tree to list (for parent selector). Each item has id, name, depth, path (ids). */
function flattenTree(
  roots: ConsultationType[],
  depth = 0,
  path: number[] = []
): { id: number; name: string; depth: number; path: number[] }[] {
  const out: { id: number; name: string; depth: number; path: number[] }[] = [];
  for (const node of roots) {
    const p = [...path, node.id];
    out.push({ id: node.id, name: node.name, depth, path: p });
    if (Array.isArray(node.children) && node.children.length > 0) {
      out.push(...flattenTree(node.children, depth + 1, p));
    }
  }
  return out;
}

/** Reorder tree in memory: apply new sibling order under parentId (null = roots). No API call. */
function applyReorderToTree(
  tree: ConsultationType[],
  parentId: number | null,
  orderedIds: number[]
): ConsultationType[] {
  if (parentId === null) {
    return orderedIds
      .map((id) => tree.find((n) => n.id === id))
      .filter((n): n is ConsultationType => n != null);
  }
  function reorderChildren(nodes: ConsultationType[]): ConsultationType[] {
    return nodes.map((node) => {
      if (node.id === parentId) {
        const reordered = orderedIds
          .map((id) => (node.children ?? []).find((c) => c.id === id))
          .filter((n): n is ConsultationType => n != null);
        return { ...node, children: reordered };
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        return { ...node, children: reorderChildren(node.children) };
      }
      return { ...node };
    });
  }
  return reorderChildren(tree);
}

type ModalMode = "edit" | "addChild" | "addRoot" | null;

interface TreeRowProps {
  node: ConsultationType;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (node: ConsultationType) => void;
  onAddChild: (node: ConsultationType) => void;
  onDelete: (node: ConsultationType) => void;
  onReorder: (parentId: number | null, orderedIds: number[]) => void;
  siblings: ConsultationType[];
  siblingIndex: number;
  parentId: number | null;
  isLast: boolean;
  parentPath: number[];
}

function TreeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onReorder,
  siblings,
  siblingIndex,
  parentId,
  isLast,
  parentPath,
}: TreeRowProps) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const indentPx = 28 * depth;

  const [{ isDragging }, dragRef] = useDrag({
    type: TREE_NODE_TYPE,
    item: () => ({ nodeId: node.id, parentId, fromIndex: siblingIndex }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, dropRef] = useDrop({
    accept: TREE_NODE_TYPE,
    drop: (item: { nodeId: number; parentId: number | null; fromIndex: number }) => {
      if (item.parentId !== parentId || item.nodeId === node.id) return;
      const ids = siblings.map((s) => s.id);
      const [draggedId] = ids.splice(item.fromIndex, 1);
      ids.splice(siblingIndex, 0, draggedId);
      onReorder(parentId, ids);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      dragRef(el);
      dropRef(el);
    },
    [dragRef, dropRef]
  );

  return (
    <div className="relative flex flex-col">
      {depth > 0 && (
        <div
          className="absolute bottom-0 left-0 top-0 w-px bg-gray-200 dark:bg-gray-700"
          style={{
            left: 14 + 28 * (depth - 1),
            top: 0,
            bottom: isLast && !hasChildren ? "50%" : 0,
          }}
        />
      )}

      <div
        ref={setRef}
        className={`group relative flex min-h-[52px] cursor-grab active:cursor-grabbing flex-wrap items-center gap-3 rounded-xl border py-2.5 pl-3 pr-3 transition-all dark:bg-white/[0.02] ${
          isDragging
            ? "border-brand-400 opacity-50 dark:border-brand-500"
            : isOver
              ? "border-brand-300 bg-brand-50/50 dark:border-brand-600 dark:bg-brand-500/10"
              : "border-gray-100 bg-white hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:hover:border-brand-800/50 dark:hover:bg-white/[0.04]"
        }`}
        style={{ marginLeft: indentPx }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="h-5 w-5" />
            ) : (
              <AngleRightIcon className="h-5 w-5" />
            )
          ) : (
            <span className="h-5 w-5" />
          )}
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-brand-600/10 text-brand-600 dark:from-brand-500/20 dark:to-brand-600/15 dark:text-brand-400">
          <FolderIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">
              {node.name}
            </span>
            {node.code && (
              <Badge variant="light" color="light" size="sm">
                {node.code}
              </Badge>
            )}
            {node.employmentType && (
              <Badge variant="light" color="info" size="sm">
                {node.employmentType}
              </Badge>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              #{node.id}
            </span>
          </div>
          {node.description && (
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
              {node.description}
            </p>
          )}
        </div>

        <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-1 rounded-lg bg-gray-50/80 p-1 dark:bg-gray-800/50">
          <Link
            to={`/consultation-types/config/${node.id}`}
            className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
            title="Configure services & verification"
          >
            Configure
          </Link>
          <button
            type="button"
            onClick={() => onAddChild(node)}
            className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
            title="Add child"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Add child</span>
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="inline-flex h-9 w-9 min-w-[44px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-600 dark:hover:text-gray-200"
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="inline-flex h-9 w-9 min-w-[44px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            title="Remove"
          >
            <TrashBinIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children!.map((child, idx) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onReorder={onReorder}
              siblings={node.children!}
              siblingIndex={idx}
              parentId={node.id}
              isLast={idx === node.children!.length - 1}
              parentPath={[...parentPath, node.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex h-14 animate-pulse items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30"
          style={{ marginLeft: i * 20 }}
        >
          <div className="ml-3 h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-48 rounded bg-gray-100 dark:bg-gray-700/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConsultationTypeTree() {
  const [tree, setTree] = useState<ConsultationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedNode, setSelectedNode] = useState<ConsultationType | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formEmploymentType, setFormEmploymentType] = useState("");
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [formCommissionPercent, setFormCommissionPercent] = useState("0");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  /** Bumps when modals open/close so file inputs reset. */
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ConsultationType | null>(null);

  /** Pending reorder changes: parentId -> orderedIds. Submit via "Save order" button. */
  const [pendingReorder, setPendingReorder] = useState<Map<number | null, number[]>>(new Map());
  const [savingOrder, setSavingOrder] = useState(false);

  /** Refetch tree. Use silent: true after add/edit/delete to avoid full-page skeleton (faster feel). */
  const fetchTree = useCallback(async (_signal?: AbortSignal, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    let aborted = false;
    try {
      const response = await consultationTypesApi.getAll();
      const data = response.data as ConsultationType[] | ConsultationType | null | undefined;
      setTree(normalizeTree(data));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        return;
      }
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load consultation types.";
      if (!silent) setError(message);
      if (!silent) setTree([]);
    } finally {
      if (!aborted && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTree(controller.signal);
    return () => controller.abort();
  }, [fetchTree]);

  useEffect(() => {
    if (!formImageFile || !formImageFile.type.startsWith("image/")) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(formImageFile);
    setImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [formImageFile]);

  /** Edit modal: new file preview wins; otherwise show saved `imageUrl` from the node. */
  const editModalImagePreviewSrc = useMemo(() => {
    if (modalMode !== "edit") return null;
    if (imagePreviewUrl) return imagePreviewUrl;
    const stored = selectedNode?.imageUrl?.trim();
    if (!stored) return null;
    return resolveConsultationTypeImageUrl(stored) || null;
  }, [modalMode, imagePreviewUrl, selectedNode?.imageUrl]);

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);

  const expandAll = () => {
    const collectIds = (nodes: ConsultationType[]): number[] => {
      let ids: number[] = [];
      for (const n of nodes) {
        ids.push(n.id);
        if (Array.isArray(n.children) && n.children.length > 0) {
          ids = ids.concat(collectIds(n.children));
        }
      }
      return ids;
    };
    setExpandedIds(new Set(collectIds(tree)));
  };

  const collapseAll = () => setExpandedIds(new Set());

  const openEdit = (node: ConsultationType) => {
    setSelectedNode(node);
    setFormName(node.name);
    setFormDescription(node.description ?? "");
    setFormCode(node.code ?? "");
    setFormEmploymentType(node.employmentType ?? "");
    setFormParentId(node.parentId ?? null);
    setFormCommissionPercent(
      node.platformCommissionPercent != null
        ? String(node.platformCommissionPercent)
        : ""
    );
    setFormImageFile(null);
    setImageFieldKey((k) => k + 1);
    setFormError("");
    setModalMode("edit");
  };

  const openAddChild = (node: ConsultationType) => {
    setSelectedNode(node);
    setFormName("");
    setFormDescription("");
    setFormCode("");
    setFormEmploymentType("INDEPENDENT");
    setFormCommissionPercent("0");
    setFormImageFile(null);
    setImageFieldKey((k) => k + 1);
    setFormError("");
    setModalMode("addChild");
  };

  const openAddRoot = () => {
    setSelectedNode(null);
    setFormName("");
    setFormDescription("");
    setFormCode("");
    setFormEmploymentType("INDEPENDENT");
    setFormCommissionPercent("0");
    setFormImageFile(null);
    setImageFieldKey((k) => k + 1);
    setFormError("");
    setModalMode("addRoot");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedNode(null);
    setFormName("");
    setFormDescription("");
    setFormCode("");
    setFormEmploymentType("");
    setFormParentId(null);
    setFormCommissionPercent("0");
    setFormImageFile(null);
    setImageFieldKey((k) => k + 1);
    setFormError("");
    setSubmitting(false);
  };

  const uploadImageIfNeeded = async (): Promise<string | undefined> => {
    if (!formImageFile) return undefined;
    const uploadData = await uploadFileToStorage(formImageFile);
    return JSON.stringify(uploadData);
  };

  const handleSubmitEdit = async () => {
    if (!selectedNode) return;
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    const commissionStr = formCommissionPercent.trim();
    const commission = Number(commissionStr);
    if (
      commissionStr === "" ||
      Number.isNaN(commission) ||
      commission < 0 ||
      commission > 100
    ) {
      setFormError("Platform commission percent must be between 0 and 100.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (formImageFile) {
        try {
          imageUrl = await uploadImageIfNeeded();
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr && typeof uploadErr === "object" && "message" in uploadErr
              ? String((uploadErr as { message: string }).message)
              : "Image upload failed.";
          setFormError(msg);
          return;
        }
      }
      const payload: UpdateConsultationTypeRequest = {
        name,
        description: formDescription.trim() || undefined,
        code: formCode.trim() || undefined,
        employmentType: formEmploymentType.trim() || undefined,
        parentId: formParentId ?? undefined,
        platformCommissionPercent: commission,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      };
      await consultationTypesApi.update(selectedNode.id, payload);
      closeModal();
      await fetchTree(undefined, { silent: true });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Update failed.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAddChild = async () => {
    if (!selectedNode) return;
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    const commissionStr = formCommissionPercent.trim();
    const commission = Number(commissionStr);
    if (
      commissionStr === "" ||
      Number.isNaN(commission) ||
      commission < 0 ||
      commission > 100
    ) {
      setFormError("Platform commission percent must be between 0 and 100.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (formImageFile) {
        try {
          imageUrl = await uploadImageIfNeeded();
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr && typeof uploadErr === "object" && "message" in uploadErr
              ? String((uploadErr as { message: string }).message)
              : "Image upload failed.";
          setFormError(msg);
          return;
        }
      }
      const payload: CreateConsultationTypeRequest = {
        name,
        description: formDescription.trim() || undefined,
        code: formCode.trim() || undefined,
        employmentType: formEmploymentType.trim() || undefined,
        parentId: selectedNode.id,
        platformCommissionPercent: commission,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      };
      await consultationTypesApi.create(payload);
      closeModal();
      setExpandedIds((prev) => new Set(prev).add(selectedNode.id));
      await fetchTree(undefined, { silent: true });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Create failed.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAddRoot = async () => {
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    const commissionStr = formCommissionPercent.trim();
    const commission = Number(commissionStr);
    if (
      commissionStr === "" ||
      Number.isNaN(commission) ||
      commission < 0 ||
      commission > 100
    ) {
      setFormError("Platform commission percent must be between 0 and 100.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (formImageFile) {
        try {
          imageUrl = await uploadImageIfNeeded();
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr && typeof uploadErr === "object" && "message" in uploadErr
              ? String((uploadErr as { message: string }).message)
              : "Image upload failed.";
          setFormError(msg);
          return;
        }
      }
      const payload: CreateConsultationTypeRequest = {
        name,
        description: formDescription.trim() || undefined,
        code: formCode.trim() || undefined,
        employmentType: formEmploymentType.trim() || undefined,
        platformCommissionPercent: commission,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      };
      await consultationTypesApi.create(payload);
      closeModal();
      await fetchTree(undefined, { silent: true });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Create failed.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Apply reorder locally only (smooth drag). Call handleSaveOrder to persist. */
  const handleReorder = useCallback((parentId: number | null, orderedIds: number[]) => {
    setTree((prev) => applyReorderToTree(prev, parentId, orderedIds));
    setPendingReorder((prev) => new Map(prev).set(parentId, orderedIds));
  }, []);

  /** Persist all pending reorder changes to the backend, then refetch. */
  const handleSaveOrder = useCallback(async () => {
    if (pendingReorder.size === 0) return;
    setSavingOrder(true);
    try {
      for (const [parentId, orderedIds] of pendingReorder) {
        await consultationTypesApi.reorder({ parentId, orderedIds });
      }
      setPendingReorder(new Map());
      await fetchTree(undefined, { silent: true });
    } catch {
      await fetchTree(undefined, { silent: true });
    } finally {
      setSavingOrder(false);
    }
  }, [pendingReorder, fetchTree]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await consultationTypesApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      await fetchTree(undefined, { silent: true });
    } catch {
      // Keep modal open
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Parent options for "Move" in edit: exclude self and descendants
  const parentOptions = useMemo(() => {
    if (!selectedNode) return flatNodes;
    const selfAndDescendantIds = new Set<number>();
    const addDescendants = (nodes: ConsultationType[]) => {
      for (const n of nodes) {
        selfAndDescendantIds.add(n.id);
        if (Array.isArray(n.children) && n.children.length > 0) addDescendants(n.children);
      }
    };
    const findAndMark = (nodes: ConsultationType[]): boolean => {
      for (const n of nodes) {
        if (n.id === selectedNode.id) {
          selfAndDescendantIds.add(n.id);
          if (Array.isArray(n.children)) addDescendants(n.children);
          return true;
        }
        if (Array.isArray(n.children) && findAndMark(n.children)) return true;
      }
      return false;
    };
    findAndMark(tree);
    return flatNodes.filter((f) => !selfAndDescendantIds.has(f.id));
  }, [tree, selectedNode, flatNodes]);

  return (
    <>
      <PageMeta
        title="Consultation Type Tree | Hope - BMQAS"
        description="Manage consultation type hierarchy"
      />
      <PageBreadcrumb pageTitle="Consultation Type Tree" />

      <div className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Consultation Types
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add, edit, reorder, or remove types. Drag rows to change order, then Save order.
            </p>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-3 sm:w-auto">
            <Button
              variant="primary"
              size="md"
              startIcon={<PlusIcon className="h-4 w-4" />}
              onClick={openAddRoot}
              disabled={loading}
              className="w-full rounded-xl shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto"
            >
              Add root type
            </Button>
            <span className="hidden h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:inline-block" aria-hidden />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAll}
                disabled={loading || tree.length === 0}
                title="Expand all"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
              >
                <ChevronDownIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={collapseAll}
                disabled={loading || tree.length === 0}
                title="Collapse all"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              startIcon={<FolderIcon className="h-4 w-4" />}
              onClick={() => fetchTree()}
              disabled={loading}
              className="rounded-xl transition-colors duration-200"
            >
              Refresh
            </Button>
            {pendingReorder.size > 0 && (
              <>
                <span className="hidden h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:inline-block" aria-hidden />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                  className="rounded-xl transition-colors duration-200"
                >
                  {savingOrder ? "Saving…" : `Save order (${pendingReorder.size})`}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {loading && <TreeSkeleton />}

          {!loading && error && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
              {(error.includes("Failed query") || error.includes("consultation_types")) && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This error is from the backend. Fix the GET /consultation-types endpoint so the
                  database query runs with correct parameters.
                </p>
              )}
            </div>
          )}

          {!loading && !error && tree.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-12 dark:border-gray-700 dark:bg-gray-800/30 sm:py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/20 dark:text-brand-400">
                <FolderIcon className="h-10 w-10" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                No consultation types yet
              </h3>
              <p className="mt-1 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
                Add your first root type to start building the tree. You can then add children to any node.
              </p>
              <Button
                variant="primary"
                className="mt-6"
                startIcon={<PlusIcon className="h-4 w-4" />}
                onClick={openAddRoot}
              >
                Add root type
              </Button>
            </div>
          )}

          {!loading && !error && tree.length > 0 && (
            <DndProvider backend={HTML5Backend}>
              <div className="space-y-2">
                {tree.map((root, idx) => (
                  <TreeRow
                    key={root.id}
                    node={root}
                    depth={0}
                    expandedIds={expandedIds}
                    onToggle={toggleExpand}
                    onEdit={openEdit}
                    onAddChild={openAddChild}
                    onDelete={(node) => setDeleteTarget(node)}
                    onReorder={handleReorder}
                    siblings={tree}
                    siblingIndex={idx}
                    parentId={null}
                    isLast={idx === tree.length - 1 && (!root.children || root.children.length === 0)}
                    parentPath={[]}
                  />
                ))}
              </div>
            </DndProvider>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Modal isOpen={modalMode === "edit"} onClose={closeModal} className="max-w-lg p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit type</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">ID: {selectedNode?.id}</p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Type name"
              error={!!formError}
              hint={formError}
            />
          </div>
          <div>
            <Label htmlFor="edit-desc">Description (optional)</Label>
            <TextArea
              id="edit-desc"
              rows={2}
              value={formDescription}
              onChange={setFormDescription}
              placeholder="Short description"
            />
          </div>
          <div>
            <Label htmlFor="edit-code">Code (optional, unique)</Label>
            <Input
              id="edit-code"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. DOCTORS"
            />
          </div>
          <div>
            <Label htmlFor="edit-employment">Employment type</Label>
            <select
              id="edit-employment"
              value={formEmploymentType}
              onChange={(e) => setFormEmploymentType(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-700"
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="edit-commission">Platform commission %</Label>
            <Input
              id="edit-commission"
              type="number"
              min="0"
              max="100"
              step={0.01}
              value={formCommissionPercent}
              onChange={(e) => setFormCommissionPercent(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <Label htmlFor="edit-image">Image (optional)</Label>
            <input
              key={`edit-image-${imageFieldKey}`}
              id="edit-image"
              type="file"
              accept="image/*"
              className={IMAGE_FILE_INPUT_CLASS}
              onChange={(e) => setFormImageFile(e.target.files?.[0] ?? null)}
            />
            <ImagePickPreview
              previewUrl={editModalImagePreviewSrc}
              fileName={formImageFile?.name ?? null}
              existingCaption={
                !formImageFile && selectedNode?.imageUrl?.trim()
                  ? "Current image — choose a new file to replace"
                  : null
              }
            />
          </div>
          <div>
            <Label htmlFor="edit-parent">Parent (move type)</Label>
            <select
              id="edit-parent"
              value={formParentId ?? ""}
              onChange={(e) => setFormParentId(e.target.value === "" ? null : Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-700"
            >
              <option value="">— Root (no parent) —</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {"—".repeat(opt.depth)} {opt.name} (#{opt.id})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={closeModal} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitEdit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>

      {/* Add child modal */}
      <Modal isOpen={modalMode === "addChild"} onClose={closeModal} className="max-w-lg p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add child type</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Parent: {selectedNode?.name} (#{selectedNode?.id})
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="New type name"
              error={!!formError}
              hint={formError}
            />
          </div>
          <div>
            <Label htmlFor="add-desc">Description (optional)</Label>
            <TextArea
              id="add-desc"
              rows={2}
              value={formDescription}
              onChange={setFormDescription}
              placeholder="Short description"
            />
          </div>
          <div>
            <Label htmlFor="add-code">Code (optional, unique)</Label>
            <Input
              id="add-code"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. GENERAL_PHYSICIAN"
            />
          </div>
          <div>
            <Label htmlFor="add-employment">Employment type</Label>
            <select
              id="add-employment"
              value={formEmploymentType}
              onChange={(e) => setFormEmploymentType(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-700"
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="add-commission">Platform commission %</Label>
            <Input
              id="add-commission"
              type="number"
              min="0"
              max="100"
              step={0.01}
              value={formCommissionPercent}
              onChange={(e) => setFormCommissionPercent(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <Label htmlFor="add-image">Image (optional)</Label>
            <input
              key={`add-image-${imageFieldKey}`}
              id="add-image"
              type="file"
              accept="image/*"
              className={IMAGE_FILE_INPUT_CLASS}
              onChange={(e) => setFormImageFile(e.target.files?.[0] ?? null)}
            />
            <ImagePickPreview
              previewUrl={imagePreviewUrl}
              fileName={formImageFile?.name ?? null}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={closeModal} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitAddChild} disabled={submitting}>
            {submitting ? "Adding…" : "Add child"}
          </Button>
        </div>
      </Modal>

      {/* Add root modal */}
      <Modal isOpen={modalMode === "addRoot"} onClose={closeModal} className="max-w-lg p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add root type</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          New top-level consultation type (no parent).
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="root-name">Name</Label>
            <Input
              id="root-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Type name"
              error={!!formError}
              hint={formError}
            />
          </div>
          <div>
            <Label htmlFor="root-desc">Description (optional)</Label>
            <TextArea
              id="root-desc"
              rows={2}
              value={formDescription}
              onChange={setFormDescription}
              placeholder="Short description"
            />
          </div>
          <div>
            <Label htmlFor="root-code">Code (optional, unique)</Label>
            <Input
              id="root-code"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="e.g. DOCTORS"
            />
          </div>
          <div>
            <Label htmlFor="root-employment">Employment type</Label>
            <select
              id="root-employment"
              value={formEmploymentType}
              onChange={(e) => setFormEmploymentType(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-700"
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="root-commission">Platform commission %</Label>
            <Input
              id="root-commission"
              type="number"
              min="0"
              max="100"
              step={0.01}
              value={formCommissionPercent}
              onChange={(e) => setFormCommissionPercent(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <Label htmlFor="root-image">Image (optional)</Label>
            <input
              key={`root-image-${imageFieldKey}`}
              id="root-image"
              type="file"
              accept="image/*"
              className={IMAGE_FILE_INPUT_CLASS}
              onChange={(e) => setFormImageFile(e.target.files?.[0] ?? null)}
            />
            <ImagePickPreview
              previewUrl={imagePreviewUrl}
              fileName={formImageFile?.name ?? null}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={closeModal} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitAddRoot} disabled={submitting}>
            {submitting ? "Adding…" : "Add root type"}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove consultation type"
        message={
          deleteTarget ? (
            <>
              Remove &quot;{deleteTarget.name}&quot; (#{deleteTarget.id})? This may fail if the type
              is in use. Children (if any) may need to be moved or removed first.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
