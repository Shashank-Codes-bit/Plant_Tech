// The bill as a PDF: share it (WhatsApp, Drive…) or download it into a folder on the phone.
// Android asks once which folder to save in (it opens on Downloads) and remembers it.
// In a computer's browser both open the bill page, which has its own Download PDF button.
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";

import { apiGet, fetchText } from "@/src/api";
import { storage } from "@/src/utils/storage";

const FOLDER_KEY = "nurserypos_bill_folder_v1";
const DOWNLOADS = "content://com.android.externalstorage.documents/tree/primary%3ADownload";
const PDF = "application/pdf";

export type BillFileResult = "saved" | "shared" | "opened" | "cancelled";

const fileName = (invoiceNumber: string) => `Bill ${invoiceNumber.replace(/[^\w-]/g, "")}.pdf`;

async function openBillPage(invoiceId: string): Promise<BillFileResult> {
  const { url } = await apiGet(`/invoices/${invoiceId}/share`);
  window.open(url, "_blank", "noopener");
  return "opened";
}

// A PDF of the bill in the app's cache, named "Bill INV-0001.pdf".
async function makePdf(invoiceId: string, invoiceNumber: string): Promise<File> {
  const html = await fetchText(`/invoices/${invoiceId}/html`);
  const { uri } = await Print.printToFileAsync({ html, width: 420, height: 595 }); // A5
  const made = new File(uri);
  const named = new File(Paths.cache, fileName(invoiceNumber));
  try {
    if (named.exists) named.delete();
    await made.copy(named);
    return named;
  } catch {
    return made;
  }
}

export async function shareBillPdf(invoiceId: string, invoiceNumber: string): Promise<BillFileResult> {
  if (Platform.OS === "web") return openBillPage(invoiceId);
  const pdf = await makePdf(invoiceId, invoiceNumber);
  await Sharing.shareAsync(pdf.uri, { mimeType: PDF, UTI: "com.adobe.pdf", dialogTitle: invoiceNumber });
  return "shared";
}

export async function downloadBillPdf(invoiceId: string, invoiceNumber: string): Promise<BillFileResult> {
  if (Platform.OS === "web") return openBillPage(invoiceId);
  const pdf = await makePdf(invoiceId, invoiceNumber);
  if (Platform.OS !== "android") {
    // iPhone has no Downloads folder: the share sheet's "Save to Files" does this.
    await Sharing.shareAsync(pdf.uri, { mimeType: PDF, UTI: "com.adobe.pdf" });
    return "shared";
  }
  const bytes = await pdf.bytes();
  const saved = await storage.getItem<string | null>(FOLDER_KEY, null);
  if (saved) {
    try {
      new Directory(saved).createFile(fileName(invoiceNumber), PDF).write(bytes);
      return "saved";
    } catch {
      // The phone forgot the folder permission: ask again below.
    }
  }
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync(DOWNLOADS);
  } catch {
    return "cancelled";
  }
  folder.createFile(fileName(invoiceNumber), PDF).write(bytes);
  await storage.setItem(FOLDER_KEY, folder.uri);
  return "saved";
}
