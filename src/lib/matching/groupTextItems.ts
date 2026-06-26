import type {
  ExtractedLabelCandidate,
  ExtractedTextItem,
  TextSource
} from "../../types/floorPlan";
import { normalizeText } from "./normalize";

export const SAME_LINE_Y_TOLERANCE = 4;
export const HORIZONTAL_GAP_TOLERANCE = 16;
export const MULTI_LINE_VERTICAL_GAP_TOLERANCE = 24;

type WorkingGroup = {
  page: number;
  items: ExtractedTextItem[];
};

export function groupTextItems(
  items: ExtractedTextItem[]
): ExtractedLabelCandidate[] {
  const sorted = items
    .filter((item) => item.text.trim().length > 0)
    .toSorted(compareReadingOrder);

  const groups: WorkingGroup[] = [];

  for (const item of sorted) {
    const current = groups.at(-1);
    if (current && shouldMergeIntoGroup(current, item)) {
      current.items.push(item);
    } else {
      groups.push({ page: item.page, items: [item] });
    }
  }

  return groups.map(toCandidate);
}

function shouldMergeIntoGroup(group: WorkingGroup, item: ExtractedTextItem): boolean {
  if (group.page !== item.page) {
    return false;
  }

  const last = group.items.at(-1);
  if (!last) {
    return false;
  }

  const sameLine = Math.abs(last.y - item.y) <= SAME_LINE_Y_TOLERANCE;
  const gap = item.x - (last.x + last.width);
  const closeHorizontally = gap >= -2 && gap <= HORIZONTAL_GAP_TOLERANCE;

  if (sameLine && closeHorizontally) {
    return true;
  }

  const groupBounds = getBounds(group.items);
  const nearbyNextLine =
    item.y - (groupBounds.y + groupBounds.height) <=
    MULTI_LINE_VERTICAL_GAP_TOLERANCE;
  const horizontallyAligned =
    item.x <= groupBounds.x + groupBounds.width &&
    item.x + item.width >= groupBounds.x;
  const shortBlock = group.items.length <= 4;

  return nearbyNextLine && horizontallyAligned && shortBlock;
}

function compareReadingOrder(
  a: ExtractedTextItem,
  b: ExtractedTextItem
): number {
  if (a.page !== b.page) {
    return a.page - b.page;
  }

  if (Math.abs(a.y - b.y) <= SAME_LINE_Y_TOLERANCE) {
    return a.x - b.x;
  }

  return a.y - b.y;
}

function toCandidate(group: WorkingGroup, index: number): ExtractedLabelCandidate {
  const sortedItems = group.items.toSorted(compareReadingOrder);
  const bounds = getBounds(sortedItems);
  const rawText = sortedItems.map((item) => item.text.trim()).join(" ");
  const sources = new Set<TextSource>(sortedItems.map((item) => item.source));

  return {
    id: `candidate-${index + 1}`,
    rawText,
    normalizedText: normalizeText(rawText),
    page: group.page,
    ...bounds,
    source: sources.size === 1 ? sortedItems[0].source : "mixed",
    childItems: sortedItems
  };
}

function getBounds(items: ExtractedTextItem[]) {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
