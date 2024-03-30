import { AmbSheetDoc } from "./datatype";

export const isFormula = (cell: string) => cell && cell[0] === "=";

export const evaluateSheet = (data: AmbSheetDoc["data"]) => {
  return data.map((row) => {
    return row.map((cell) => {
      if (isFormula(cell)) {
        return "formula result";
      } else {
        return cell;
      }
    });
  });
};
