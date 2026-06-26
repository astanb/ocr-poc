export type RoomListItem = {
  id: string;
  rawName: string;
  normalizedName: string;
  possibleCode?: string;
};

export type ParsedRoomList = {
  rooms: RoomListItem[];
  columns: string[];
  detectedColumn?: string;
  selectedColumn: string;
  confidence: number;
};
