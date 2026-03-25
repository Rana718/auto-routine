import * as XLSX from "xlsx";

/**
 * Reads a file and returns its content as CSV text.
 * If the file is an Excel file (.xlsx/.xls), converts to CSV.
 * Multi-sheet files (e.g. PickingList with 4 sheets) are combined into one CSV.
 * If the file is a CSV/text file, reads it as plain text.
 */
export async function readFileAsCSVText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        // Single sheet - return directly
        if (workbook.SheetNames.length === 1) {
            return XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        }

        // Multiple sheets: combine all sheets into one CSV.
        // Emit the header row once, then data rows from every sheet.
        const allRows: string[][] = [];
        let headerEmitted = false;

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });

            // Find the header row (contains 商品コード or product_code)
            const headerIdx = rows.findIndex((r) =>
                r.some(
                    (cell) =>
                        String(cell).includes("商品コード") ||
                        String(cell).toLowerCase().includes("product_code")
                )
            );
            if (headerIdx === -1) continue;

            if (!headerEmitted) {
                allRows.push(rows[headerIdx] as string[]);
                headerEmitted = true;
            }

            // Append non-empty data rows
            for (const row of rows.slice(headerIdx + 1)) {
                if ((row as string[]).some((cell) => cell !== "")) {
                    allRows.push(row as string[]);
                }
            }
        }

        // Serialize to CSV
        return allRows
            .map((r) =>
                r.map((cell) => {
                    const s = String(cell);
                    return s.includes(",") || s.includes('"') || s.includes("\n")
                        ? `"${s.replace(/"/g, '""')}"`
                        : s;
                }).join(",")
            )
            .join("\n");
    }

    return file.text();
}

export type ImportFormat = "purchase-list" | "picking-list" | "unknown";

/**
 * Detect whether CSV text is the purchase list format or picking list format.
 * Purchase list rows contain store information in column F, while picking list rows do not.
 */
export function detectImportFormat(csvText: string): ImportFormat {
    if (!csvText?.trim()) return "unknown";

    try {
        const workbook = XLSX.read(csvText, { type: "string" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: "" });

        const headerIdx = rows.findIndex((row) =>
            row.some(
                (cell) =>
                    String(cell).includes("商品コード") ||
                    String(cell).toLowerCase().includes("product_code")
            )
        );

        if (headerIdx === -1) return "unknown";

        let storeLikeRows = 0;
        let dataRows = 0;

        for (const row of rows.slice(headerIdx + 1, headerIdx + 301)) {
            const sku = String(row[1] ?? "").trim();
            const qty = String(row[4] ?? "").trim();
            const store = String(row[5] ?? "").trim();

            if (!sku) continue;
            dataRows += 1;

            const qtyLooksNumeric = qty === "" || !Number.isNaN(Number(qty));
            if (store && qtyLooksNumeric) {
                storeLikeRows += 1;
            }
        }

        if (dataRows === 0) return "unknown";
        return storeLikeRows >= 3 ? "purchase-list" : "picking-list";
    } catch {
        return "unknown";
    }
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
