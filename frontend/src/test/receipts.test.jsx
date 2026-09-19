import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { compressImage } from "../lib/image";
import { formatBytes } from "../components/Transactions/receipt";
import ReceiptManager from "../components/Transactions/ReceiptManager";

vi.mock("../services/transactions/transactionService", () => ({
  attachReceiptAPI: vi.fn(),
  removeReceiptAPI: vi.fn(),
  getReceiptUrlAPI: vi.fn(),
}));

const renderManager = (props) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReceiptManager {...props} />
    </QueryClientProvider>
  );

describe("comprobantes", () => {
  it("un PDF se sube tal cual, sin intentar reducirlo", async () => {
    const pdf = new File(["%PDF-1.4"], "recibo.pdf", { type: "application/pdf" });
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("si el navegador no puede decodificar la foto, sube la original", async () => {
    //! jsdom no tiene createImageBitmap: el mismo caso que un HEIC fuera de Safari
    const heic = new File(["...."], "foto.heic", { type: "image/heic" });
    expect(await compressImage(heic)).toBe(heic);
  });

  it("muestra los tamaños legibles", () => {
    expect(formatBytes(300 * 1024)).toBe("300 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toMatch(/^1[,.]5 MB$/);
  });

  it("con permiso de escritura se puede ver, quitar y reemplazar", () => {
    renderManager({
      transaction: { _id: "t1", voided: false, receipt: { format: "jpg", bytes: 250000 } },
      canWrite: true,
    });
    expect(screen.getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
    expect(screen.getByText("Reemplazar el comprobante")).toBeInTheDocument();
  });

  it("un lector solo puede verlo", () => {
    renderManager({
      transaction: { _id: "t1", voided: false, receipt: { format: "pdf", bytes: 90000 } },
      canWrite: false,
    });
    expect(screen.getByText(/PDF/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Adjuntar|Reemplazar/)).not.toBeInTheDocument();
  });
});
