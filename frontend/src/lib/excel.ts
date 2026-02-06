import * as XLSX from "xlsx";

/**
 * Reads a file and returns its content as CSV text.
 * If the file is an Excel file (.xlsx/.xls), converts the first sheet to CSV.
 * If the file is a CSV/text file, reads it as plain text.
 */
export async function readFileAsCSVText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_csv(firstSheet);
    }

    return file.text();
}
