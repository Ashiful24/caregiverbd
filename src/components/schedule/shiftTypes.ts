export type ShiftType = "shift_8h" | "shift_12h" | "shift_4h";

export type ShiftOption = {
  id: ShiftType;
  label: string;
  hours: number;
  capacity: number;
};

export const SHIFT_OPTIONS: ShiftOption[] = [
  { id: "shift_8h", label: "8h", hours: 8, capacity: 3 },
  { id: "shift_12h", label: "12h", hours: 12, capacity: 2 },
  { id: "shift_4h", label: "4h", hours: 4, capacity: 8 },
];

