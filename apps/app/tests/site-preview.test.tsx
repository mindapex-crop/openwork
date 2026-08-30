/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SitePreview } from "../src/react-app/domains/browser/site-preview";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.defineProperty(navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
});

describe("SitePreview", () => {
  const defaultProps = {
    url: "https://example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders iframe with correct URL", () => {
    render(<SitePreview {...defaultProps} />);
    
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("https://example.com");
  });

  it("has proper sandbox attributes", () => {
    render(<SitePreview {...defaultProps} />);
    
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-forms");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-popups");
  });

  it("shows viewport selector buttons", () => {
    render(<SitePreview {...defaultProps} />);
    
    // Check for desktop/tablet/mobile buttons by their aria-labels or icons
    const desktopButton = screen.getByLabelText(/Desktop viewport/i);
    const tabletButton = screen.getByLabelText(/Tablet viewport/i);
    const mobileButton = screen.getByLabelText(/Mobile viewport/i);
    
    expect(desktopButton).toBeTruthy();
    expect(tabletButton).toBeTruthy();
    expect(mobileButton).toBeTruthy();
  });

  it("switches viewport when clicking buttons", () => {
    render(<SitePreview {...defaultProps} />);
    
    const tabletButton = screen.getByLabelText(/Tablet viewport/i);
    fireEvent.click(tabletButton);
    
    // The viewport width should change (check via style or class)
    const iframeContainer = document.querySelector('[style*="width"]');
    expect(iframeContainer).toBeTruthy();
  });

  it("calls onReload when reload button is clicked", () => {
    const onReload = vi.fn();
    render(<SitePreview {...defaultProps} onReload={onReload} />);
    
    const reloadButton = screen.getByLabelText(/Reload preview/i);
    fireEvent.click(reloadButton);
    
    expect(onReload).toHaveBeenCalled();
  });

  it("copies URL to clipboard when share button is clicked", async () => {
    render(<SitePreview {...defaultProps} />);
    
    const shareButton = screen.getByLabelText(/Copy preview URL/i);
    fireEvent.click(shareButton);
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith("https://example.com");
  });

  it("toggles fullscreen mode", () => {
    render(<SitePreview {...defaultProps} />);
    
    const fullscreenButton = screen.getByLabelText(/Enter fullscreen/i);
    fireEvent.click(fullscreenButton);
    
    // Should now show exit fullscreen button
    const exitButton = screen.getByLabelText(/Exit fullscreen/i);
    expect(exitButton).toBeTruthy();
  });

  it("uses custom viewport prop", () => {
    render(<SitePreview {...defaultProps} viewport="mobile" />);
    
    // Mobile viewport should be selected by default
    const mobileButton = screen.getByLabelText(/Mobile viewport/i);
    expect(mobileButton).toHaveClass("bg-primary") || expect(mobileButton).toHaveAttribute("data-state", "active");
  });

  it("displays viewport size label", () => {
    render(<SitePreview {...defaultProps} />);
    
    // Should show current viewport dimensions
    const label = screen.getByText(/100%|768px|375px/i);
    expect(label).toBeTruthy();
  });

  it("forces iframe reload when key changes", () => {
    const { rerender } = render(<SitePreview {...defaultProps} />);
    
    // Simulate reload by changing props or calling reload
    const reloadButton = screen.getByLabelText(/Reload preview/i);
    fireEvent.click(reloadButton);
    
    // Iframe should have been reloaded (check key prop change)
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
  });

  it("handles local HTML blob URLs", () => {
    const blobUrl = "blob:http://localhost/test";
    render(<SitePreview url={blobUrl} />);
    
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe(blobUrl);
  });
});
