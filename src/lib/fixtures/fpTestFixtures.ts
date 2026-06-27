export type FixtureFile = {
  id: string;
  label: string;
  fileName: string;
};

export const ROOM_LIST_FIXTURES: FixtureFile[] = [
  { id: "0", label: "Set 0 room list", fileName: "0.xlsx" },
  { id: "1", label: "Set 1 room list", fileName: "1.xlsx" },
  { id: "2-1F", label: "Set 2 - 1F room list", fileName: "2-1F.xlsx" },
  { id: "2-GF", label: "Set 2 - GF room list", fileName: "2-GF.xlsx" },
  { id: "2-LG", label: "Set 2 - LG room list", fileName: "2-LG.xlsx" },
  { id: "3", label: "Set 3 room list", fileName: "3.xlsx" },
  { id: "4", label: "Set 4 room list", fileName: "4.xlsx" },
  { id: "5", label: "Set 5 room list", fileName: "5.xlsx" },
  { id: "6", label: "Set 6 room list", fileName: "6.xlsx" },
  { id: "6-GF", label: "Set 6 - GF room list", fileName: "6-GF.xlsx" },
  { id: "7-1F", label: "Set 7 - 1F room list", fileName: "7-1F.xlsx" },
  { id: "7-GF", label: "Set 7 - GF room list", fileName: "7-GF.xlsx" },
  { id: "8", label: "Set 8 room list", fileName: "8.xlsx" },
  { id: "9-FF", label: "Set 9 - FF room list", fileName: "9-FF.xlsx" },
  { id: "9-GF", label: "Set 9 - GF room list", fileName: "9-GF.xlsx" }
];

export const FLOOR_PLAN_FIXTURES: FixtureFile[] = [
  { id: "0", label: "Set 0 - PDF", fileName: "0.pdf" },
  { id: "1", label: "Set 1 - JPG", fileName: "1.jpg" },
  { id: "2-1F", label: "Set 2 - 1F PDF", fileName: "2-1F.pdf" },
  { id: "2-GF", label: "Set 2 - GF PDF", fileName: "2-GF.pdf" },
  { id: "2-LG", label: "Set 2 - LG PDF", fileName: "2-LG.pdf" },
  { id: "3", label: "Set 3 - PDF", fileName: "3.pdf" },
  { id: "4", label: "Set 4 - PDF", fileName: "4.pdf" },
  { id: "5", label: "Set 5 - PDF", fileName: "5.pdf" },
  { id: "6-GF", label: "Set 6 - GF PDF", fileName: "6-GF.pdf" },
  { id: "6-Mez", label: "Set 6 - Mez PDF", fileName: "6-Mez.pdf" },
  { id: "7-1F", label: "Set 7 - 1F PDF", fileName: "7-1F.pdf" },
  { id: "7-GF", label: "Set 7 - GF PDF", fileName: "7-GF.pdf" },
  { id: "8", label: "Set 8 - PDF", fileName: "8.pdf" },
  { id: "9-FF", label: "Set 9 - FF PDF", fileName: "9-FF.pdf" },
  { id: "9-GF", label: "Set 9 - GF PDF", fileName: "9-GF.pdf" }
];

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

export function getDefaultRoomListIdForFloorPlan(floorPlanId: string): string {
  if (ROOM_LIST_FIXTURES.some((fixture) => fixture.id === floorPlanId)) {
    return floorPlanId;
  }

  return floorPlanId.split("-")[0] ?? floorPlanId;
}

export function getFixtureById(
  fixtures: FixtureFile[],
  id: string
): FixtureFile | undefined {
  return fixtures.find((fixture) => fixture.id === id);
}

export async function loadFixtureFile(fixture: FixtureFile): Promise<File> {
  const response = await fetch(getFixtureUrl(fixture.fileName));

  if (!response.ok) {
    throw new Error(`Could not load fixture ${fixture.fileName}.`);
  }

  return new File([await response.blob()], fixture.fileName, {
    type: getMimeType(fixture.fileName)
  });
}

function getFixtureUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}fixtures/fp-tests/${encodeURIComponent(fileName)}`;
}

function getMimeType(fileName: string): string {
  const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}
