"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogConfigV1 } from "@/lib/config/appConfigSchema";
import {
  defaultCatalogConfig,
  fullGridPricingConfigFallback,
} from "@/lib/config/appConfigSchema";
import { FREESHIP_THRESHOLD_VND } from "@/lib/config/business";
import {
  DELIVERY_WARDS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from "@/lib/config/orderForm";
import { publicConfig } from "@/lib/config/public";
import {
  buildOrderSpecFromSnapshot,
  estimatePagesForPricing,
  printColorSidesForDb,
  type OrderFormSnapshot,
} from "@/lib/orders/createOrder";
import type { DeliveryMethod } from "@/lib/orders/delivery";
import type {
  BindingType,
  PageScope,
  PrintJobKind,
} from "@/lib/orders/printJobSpec";
import type { PublicAppConfigV1 } from "@/lib/config/publicAppConfig";
import { PAPER_SIZES } from "@/lib/orders/printJobSpec";
import { formatFileTooLargeMessage } from "@/lib/orders/orderForm";
import type { PrintColor, PrintSides } from "@/lib/orders/printOptions";
import { grandTotalFromPrintSubtotal } from "@/lib/payments/pricing";
import { computePrintSubtotalForOrder } from "@/lib/payments/printSubtotal";

export type FormStatus = "idle" | "loading" | "success" | "error";

const DEFAULT_PAPER = PAPER_SIZES[1];

export function useCreateOrderForm() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageCountInput, setPageCountInput] = useState("");
  const [copiesInput, setCopiesInput] = useState("1");
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("pickup");
  const [printColor, setPrintColor] = useState<PrintColor>("bw");
  const [printSides, setPrintSides] = useState<PrintSides>("double");
  const [deliveryDistrict, setDeliveryDistrict] = useState<string>(
    DELIVERY_WARDS[0],
  );
  const [deliveryDetail, setDeliveryDetail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  const [printJobKind, setPrintJobKind] = useState<PrintJobKind>("document");
  const [docPaperSize, setDocPaperSize] = useState<string>(DEFAULT_PAPER);
  const [docPaperGsm, setDocPaperGsm] = useState("80");
  const [docPageScope, setDocPageScope] = useState<PageScope>("all");
  const [docRangeFrom, setDocRangeFrom] = useState("1");
  const [docRangeTo, setDocRangeTo] = useState("");
  const [bookPaperSize, setBookPaperSize] = useState<string>(DEFAULT_PAPER);
  const [bookBodyPages, setBookBodyPages] = useState("");
  const [bookBodyGsm, setBookBodyGsm] = useState("80");
  const [bookBodyColor, setBookBodyColor] = useState<PrintColor>("bw");
  const [bookBodySides, setBookBodySides] = useState<PrintSides>("double");
  const [bookCoverPages, setBookCoverPages] = useState("2");
  const [bookCoverGsm, setBookCoverGsm] = useState("250");
  const [bookCoverColor, setBookCoverColor] = useState<PrintColor>("color");
  const [bookBinding, setBookBinding] = useState<BindingType>("spring_plastic");

  const [publicAppConfig, setPublicAppConfig] =
    useState<PublicAppConfigV1 | null>(null);
  const [publicConfigStatus, setPublicConfigStatus] = useState<
    "loading" | "ok" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/config", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const j = (await res.json()) as PublicAppConfigV1;
        if (!cancelled) {
          setPublicAppConfig(j);
          setPublicConfigStatus("ok");
        }
      } catch {
        if (!cancelled) setPublicConfigStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publicAppConfig?.delivery.wards.length) return;
    const w = publicAppConfig.delivery.wards;
    setDeliveryDistrict((prev) => (w.includes(prev) ? prev : w[0]));
  }, [publicAppConfig]);

  const pagesParsed = useMemo(
    () =>
      estimatePagesForPricing({
        printJobKind,
        pageCountInput,
        docPageScope,
        docRangeFrom,
        docRangeTo,
        bookBodyPages,
        bookCoverPages,
      }),
    [
      printJobKind,
      pageCountInput,
      docPageScope,
      docRangeFrom,
      docRangeTo,
      bookBodyPages,
      bookCoverPages,
    ],
  );

  const copiesParsed = copiesInput.trim()
    ? parseInt(copiesInput.trim(), 10)
    : 1;

  const totalPrice = useMemo(() => {
    if (
      pagesParsed == null ||
      pagesParsed <= 0 ||
      !Number.isFinite(copiesParsed) ||
      copiesParsed <= 0
    ) {
      return null;
    }

    const snap: OrderFormSnapshot = {
      customerName,
      phone,
      note,
      copiesInput,
      pageCountInput,
      deliveryMethod,
      deliveryDistrict,
      deliveryDetail,
      printColor,
      printSides,
      printJobKind,
      docPaperSize,
      docPaperGsm,
      docPageScope,
      docRangeFrom,
      docRangeTo,
      bookPaperSize,
      bookBodyPages,
      bookBodyGsm,
      bookBodyColor,
      bookBodySides,
      bookCoverPages,
      bookCoverGsm,
      bookCoverColor,
      bookBinding,
    };

    const orderSpec = buildOrderSpecFromSnapshot(snap);
    const { printColor: pc, printSides: ps } = printColorSidesForDb(snap);

    const catalogForFallback: CatalogConfigV1 =
      publicConfigStatus === "ok" && publicAppConfig
        ? {
            v: 1,
            paperSizes: [...publicAppConfig.catalog.paperSizes],
            gsmOptions: [...publicAppConfig.catalog.gsmOptions],
            bindingOptions: publicAppConfig.catalog.bindingOptions.map((b) => ({
              value: b.value,
              label: b.label,
            })),
            printJobKindOptions:
              publicAppConfig.catalog.printJobKindOptions.map((o) => ({
                value: o.value,
                label: o.label,
              })),
          }
        : defaultCatalogConfig();

    const pricing =
      publicConfigStatus === "ok" && publicAppConfig
        ? publicAppConfig.pricing
        : fullGridPricingConfigFallback(
            publicConfig.pricePerPage,
            catalogForFallback,
          );

    const printSubtotal = computePrintSubtotalForOrder({
      orderSpec,
      totalPages: pagesParsed,
      copies: copiesParsed,
      printColor: pc,
      printSides: ps,
      pricing,
      fallbackPricePerPage: publicConfig.pricePerPage,
    });

    const freeshipThreshold =
      publicConfigStatus === "ok" && publicAppConfig
        ? publicAppConfig.delivery.freeshipThresholdVnd
        : FREESHIP_THRESHOLD_VND;

    const shippingFeeDelivery =
      publicConfigStatus === "ok" && publicAppConfig
        ? publicAppConfig.delivery.shippingFeeDelivery
        : undefined;

    return grandTotalFromPrintSubtotal(printSubtotal, deliveryMethod, {
      freeshipThresholdVnd: freeshipThreshold,
      shippingFeeDelivery,
    }).total;
  }, [
    pagesParsed,
    copiesParsed,
    deliveryMethod,
    publicConfigStatus,
    publicAppConfig,
    customerName,
    phone,
    note,
    copiesInput,
    pageCountInput,
    deliveryDistrict,
    deliveryDetail,
    printColor,
    printSides,
    printJobKind,
    docPaperSize,
    docPaperGsm,
    docPageScope,
    docRangeFrom,
    docRangeTo,
    bookPaperSize,
    bookBodyPages,
    bookBodyGsm,
    bookBodyColor,
    bookBodySides,
    bookCoverPages,
    bookCoverGsm,
    bookCoverColor,
    bookBinding,
  ]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files?.[0];
      if (!chosen) {
        setFile(null);
        setPageCountInput("");
        setStatus("idle");
        setMessage("");
        return;
      }
      if (chosen.size > MAX_FILE_SIZE_BYTES) {
        setFile(null);
        setPageCountInput("");
        setStatus("error");
        setMessage(formatFileTooLargeMessage(chosen, MAX_FILE_SIZE_MB));
        return;
      }
      setFile(chosen);
      setPageCountInput("");
      setStatus("idle");
      setMessage("");
    },
    [],
  );

  const appendPrintJobToFormData = useCallback(
    (formData: FormData) => {
      formData.set("printJobKind", printJobKind);
      formData.set("docPaperSize", docPaperSize);
      formData.set("docPaperGsm", docPaperGsm);
      formData.set("docPageScope", docPageScope);
      formData.set("docRangeFrom", docRangeFrom);
      formData.set("docRangeTo", docRangeTo);
      formData.set("bookPaperSize", bookPaperSize);
      formData.set("bookBodyPages", bookBodyPages);
      formData.set("bookBodyGsm", bookBodyGsm);
      formData.set("bookBodyColor", bookBodyColor);
      formData.set("bookBodySides", bookBodySides);
      formData.set("bookCoverPages", bookCoverPages);
      formData.set("bookCoverGsm", bookCoverGsm);
      formData.set("bookCoverColor", bookCoverColor);
      formData.set("bookBinding", bookBinding);
    },
    [
      printJobKind,
      docPaperSize,
      docPaperGsm,
      docPageScope,
      docRangeFrom,
      docRangeTo,
      bookPaperSize,
      bookBodyPages,
      bookBodyGsm,
      bookBodyColor,
      bookBodySides,
      bookCoverPages,
      bookCoverGsm,
      bookCoverColor,
      bookBinding,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) {
        setStatus("error");
        setMessage("Vui lòng chọn file tài liệu cần in.");
        return;
      }

      setStatus("loading");
      setMessage("Đang xử lý...");

      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("customerName", customerName);
        formData.set("phone", phone);
        formData.set("note", note);
        formData.set("copiesInput", copiesInput);
        formData.set("pageCountInput", pageCountInput);
        formData.set("deliveryMethod", deliveryMethod);
        formData.set("deliveryDistrict", deliveryDistrict);
        formData.set("deliveryDetail", deliveryDetail);
        formData.set("printColor", printColor);
        formData.set("printSides", printSides);
        appendPrintJobToFormData(formData);

        const res = await fetch("/api/orders", { method: "POST", body: formData });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          orderId?: string;
        } | null;

        if (!res.ok) {
          setStatus("error");
          setMessage(
            typeof data?.error === "string"
              ? data.error
              : "Không tạo được đơn hàng.",
          );
          return;
        }

        if (typeof data?.orderId !== "string") {
          setStatus("error");
          setMessage("Phản hồi từ server không hợp lệ.");
          return;
        }

        setStatus("success");
        setMessage("Gửi đơn thành công. Đang chuyển đến trang thanh toán...");
        router.push(`/payment/${data.orderId}`);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
      }
    },
    [
      file,
      customerName,
      phone,
      note,
      copiesInput,
      pageCountInput,
      deliveryMethod,
      deliveryDistrict,
      deliveryDetail,
      printColor,
      printSides,
      appendPrintJobToFormData,
      router,
    ],
  );

  const loading = status === "loading";

  return {
    customerName,
    setCustomerName,
    phone,
    setPhone,
    note,
    setNote,
    file,
    pageCountInput,
    setPageCountInput,
    copiesInput,
    setCopiesInput,
    deliveryMethod,
    setDeliveryMethod,
    printColor,
    setPrintColor,
    printSides,
    setPrintSides,
    deliveryDistrict,
    setDeliveryDistrict,
    deliveryDetail,
    setDeliveryDetail,
    status,
    message,
    totalPrice,
    loading,
    handleFileChange,
    handleSubmit,
    printJobKind,
    setPrintJobKind,
    docPaperSize,
    setDocPaperSize,
    docPaperGsm,
    setDocPaperGsm,
    docPageScope,
    setDocPageScope,
    docRangeFrom,
    setDocRangeFrom,
    docRangeTo,
    setDocRangeTo,
    bookPaperSize,
    setBookPaperSize,
    bookBodyPages,
    setBookBodyPages,
    bookBodyGsm,
    setBookBodyGsm,
    bookBodyColor,
    setBookBodyColor,
    bookBodySides,
    setBookBodySides,
    bookCoverPages,
    setBookCoverPages,
    bookCoverGsm,
    setBookCoverGsm,
    bookCoverColor,
    setBookCoverColor,
    bookBinding,
    setBookBinding,
    publicAppConfig,
    publicConfigStatus,
  };
}
