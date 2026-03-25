import { uploadPublicDocument } from "@/lib/data/storage";
import { loadNormalizedAppConfigForOrder } from "@/lib/orders/appConfig.server";
import {
  buildNewOrderId,
  buildOrderPayload,
  buildOrderSpecFromSnapshot,
  buildStorageObjectPath,
  printColorSidesForDb,
  resolveOrderTotalPages,
  validateOrderForm,
  type OrderFormSnapshot,
} from "@/lib/orders/createOrder";
import { ORDER_DOCUMENT_BUCKET } from "@/lib/orders/orderConstants";
import { insertOrderWithServiceRole } from "@/lib/orders/repository.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdfPageCountFromFile } from "@/lib/utils/pdfPageCount.server";

export type CreateCustomerOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; message: string };

function isSafeStorageObjectPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/")) {
    return false;
  }
  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
}

async function persistOrder(
  order: ReturnType<typeof buildOrderPayload>,
): Promise<CreateCustomerOrderResult> {
  const { error } = await insertOrderWithServiceRole(order);
  if (error) {
    return {
      ok: false,
      message: error.message || "Lưu đơn hàng thất bại.",
    };
  }
  return { ok: true, orderId: order.id! };
}

export async function executeCreateCustomerOrderFromFile(
  file: File,
  snap: OrderFormSnapshot,
): Promise<CreateCustomerOrderResult> {
  const supabase = createAdminClient();
  const { app } = await loadNormalizedAppConfigForOrder(supabase);
  const basics = validateOrderForm(snap, file, {
    deliveryCity: app.delivery.city,
  });
  if (!basics.ok) {
    return { ok: false, message: basics.message };
  }

  const pages = await resolveOrderTotalPages(
    file,
    snap,
    getPdfPageCountFromFile,
  );
  if (!pages.ok) {
    return { ok: false, message: pages.message };
  }

  const orderId = buildNewOrderId();
  const path = buildStorageObjectPath(file.name);

  const upload = await uploadPublicDocument(
    supabase,
    ORDER_DOCUMENT_BUCKET,
    path,
    file,
  );
  if (!upload.ok) {
    return { ok: false, message: upload.message };
  }

  const spec = buildOrderSpecFromSnapshot(snap);
  const { printColor, printSides } = printColorSidesForDb(snap);
  const order = buildOrderPayload({
    id: orderId,
    customerName: snap.customerName,
    phone: snap.phone,
    note: snap.note,
    fileName: file.name,
    fileUrl: upload.publicUrl,
    totalPages: pages.totalPages,
    copies: basics.copies,
    deliveryMethod: snap.deliveryMethod,
    deliveryDetail: snap.deliveryDetail,
    deliveryDistrict: snap.deliveryDistrict,
    printColor,
    printSides,
    orderSpec: spec,
    pricing: app.pricing,
    deliveryConfig: app.delivery,
  });

  return persistOrder(order);
}

/**
 * File đã có trong Storage (signed upload). Server tải để đếm trang; URL lưu DB lấy từ path đã biết.
 */
export async function executeCreateCustomerOrderFromStoragePath(
  fileName: string,
  storagePath: string,
  snap: OrderFormSnapshot,
): Promise<CreateCustomerOrderResult> {
  if (!isSafeStorageObjectPath(storagePath)) {
    return { ok: false, message: "Đường dẫn file không hợp lệ." };
  }

  const supabase = createAdminClient();
  const { app } = await loadNormalizedAppConfigForOrder(supabase);
  const { data: blob, error: dlError } = await supabase.storage
    .from(ORDER_DOCUMENT_BUCKET)
    .download(storagePath);

  if (dlError || !blob) {
    return {
      ok: false,
      message: dlError?.message || "Không tải được file từ storage.",
    };
  }

  const buffer = await blob.arrayBuffer();
  const file = new File([buffer], fileName, { type: blob.type });

  const basics = validateOrderForm(snap, file, {
    deliveryCity: app.delivery.city,
  });
  if (!basics.ok) {
    return { ok: false, message: basics.message };
  }

  const pages = await resolveOrderTotalPages(
    file,
    snap,
    getPdfPageCountFromFile,
  );
  if (!pages.ok) {
    return { ok: false, message: pages.message };
  }

  const orderId = buildNewOrderId();
  const { data: pub } = supabase.storage
    .from(ORDER_DOCUMENT_BUCKET)
    .getPublicUrl(storagePath);
  const fileUrl = pub.publicUrl;

  const spec = buildOrderSpecFromSnapshot(snap);
  const { printColor, printSides } = printColorSidesForDb(snap);
  const order = buildOrderPayload({
    id: orderId,
    customerName: snap.customerName,
    phone: snap.phone,
    note: snap.note,
    fileName,
    fileUrl,
    totalPages: pages.totalPages,
    copies: basics.copies,
    deliveryMethod: snap.deliveryMethod,
    deliveryDetail: snap.deliveryDetail,
    deliveryDistrict: snap.deliveryDistrict,
    printColor,
    printSides,
    orderSpec: spec,
    pricing: app.pricing,
    deliveryConfig: app.delivery,
  });

  return persistOrder(order);
}
