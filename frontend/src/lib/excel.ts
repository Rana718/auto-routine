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

/**
 * Downloads CSV text as an Excel (.xlsx) file.
 */
export function downloadAsExcel(csvText: string, filename: string) {
    const workbook = XLSX.read(csvText, { type: "string" });
    const xlsxData = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([xlsxData], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.csv$/, ".xlsx");
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
