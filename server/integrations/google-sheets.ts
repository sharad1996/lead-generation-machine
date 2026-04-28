import { google } from "googleapis";
import { logger } from "@/lib/logger";

/**
 * Append a lead row to a Google Sheet when GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID are configured.
 */
export async function appendLeadToSheet(row: Record<string, string | number | null | undefined>): Promise<void> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || "Leads!A1";

  if (!raw || !sheetId) {
    logger.debug("Google Sheets not configured; skipping append");
    return;
  }

  let credentials: object;
  try {
    credentials = JSON.parse(raw) as object;
  } catch {
    logger.error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = [
    [
      row.name ?? "",
      row.phone ?? "",
      row.email ?? "",
      row.website ?? "",
      row.address ?? "",
      row.location ?? "",
      row.rating ?? "",
      row.status ?? "",
      row.mapsLink ?? "",
      row.category ?? "",
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  logger.info("Appended lead to Google Sheet", { sheetId });
}
