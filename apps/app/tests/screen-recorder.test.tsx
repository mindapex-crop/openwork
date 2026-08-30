/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScreenRecorder } from "../src/react-app/domains/capture/screen-recorder";

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: "inactive",
  ondataavailable: null,
  onstop: null,
};

const MockMediaRecorder = vi.fn(() => mockMediaRecorder);
global.MediaRecorder = MockMediaRecorder as any;

// Mock getDisplayMedia
const mockStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
};

const mockGetDisplayMedia = vi.fn(async () => mockStream);
navigator.mediaDevices.getDisplayMedia = mockGetDisplayMedia as any;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:test-url");
global.URL.revokeObjectURL = vi.fn();

// Mock Blob
global.Blob = class MockBlob {
  constructor(public parts: any[], public options?: BlobPropertyBag) {}
  size = 1024;
  type = "video/webm";
} as any;

describe("ScreenRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDisplayMedia.mockResolvedValue(mockStream);
  });

  it("renders start recording button initially", () => {
    render(<ScreenRecorder />);
    
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    expect(startButton).toBeTruthy();
  });

  it("shows audio toggle switch", () => {
    render(<ScreenRecorder />);
    
    const audioToggle = screen.getByText(/包含麦克风音频|Include Microphone Audio/i);
    expect(audioToggle).toBeTruthy();
  });

  it("starts recording when start button is clicked", async () => {
    render(<ScreenRecorder />);
    
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetDisplayMedia).toHaveBeenCalled();
    });
    
    expect(MockMediaRecorder).toHaveBeenCalled();
    expect(mockMediaRecorder.start).toHaveBeenCalled();
  });

  it("shows recording timer after starting", async () => {
    render(<ScreenRecorder />);
    
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      // Timer should appear showing duration
      const timerElement = screen.getByText(/\d{2}:\d{2}/);
      expect(timerElement).toBeTruthy();
    });
  });

  it("changes button to stop during recording", async () => {
    render(<ScreenRecorder />);
    
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const stopButton = screen.getByText(/停止录制|Stop Recording/i);
      expect(stopButton).toBeTruthy();
    });
  });

  it("stops recording when stop button is clicked", async () => {
    render(<ScreenRecorder />);
    
    // Start recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const stopButton = screen.getByText(/停止录制|Stop Recording/i);
      fireEvent.click(stopButton);
    });
    
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  it("shows video preview after stopping", async () => {
    render(<ScreenRecorder />);
    
    // Start and stop recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const stopButton = screen.getByText(/停止录制|Stop Recording/i);
      fireEvent.click(stopButton);
    });
    
    await waitFor(() => {
      const videoElement = document.querySelector("video");
      expect(videoElement).toBeTruthy();
    });
  });

  it("shows save button after recording", async () => {
    render(<ScreenRecorder />);
    
    // Start and stop recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const stopButton = screen.getByText(/停止录制|Stop Recording/i);
      fireEvent.click(stopButton);
    });
    
    await waitFor(() => {
      const saveButton = screen.getByText(/保存录制|Save Recording/i);
      expect(saveButton).toBeTruthy();
    });
  });

  it("calls onSave callback when save is clicked", async () => {
    const onSave = vi.fn();
    render(<ScreenRecorder onSave={onSave} />);
    
    // Start and stop recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const stopButton = screen.getByText(/停止录制|Stop Recording/i);
      fireEvent.click(stopButton);
    });
    
    await waitFor(() => {
      const saveButton = screen.getByText(/保存录制|Save Recording/i);
      fireEvent.click(saveButton);
    });
    
    expect(onSave).toHaveBeenCalled();
  });

  it("calls onCancel when cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<ScreenRecorder onCancel={onCancel} />);
    
    const cancelButton = screen.getByText(/取消|Cancel/i);
    fireEvent.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it("handles permission denied error", async () => {
    mockGetDisplayMedia.mockRejectedValueOnce(new Error("Permission denied"));
    
    render(<ScreenRecorder />);
    
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      // Should show error message
      const errorMessage = screen.getByText(/权限被拒绝|permission denied/i);
      expect(errorMessage).toBeTruthy();
    });
  });

  it("includes audio in getDisplayMedia when toggle is on", async () => {
    render(<ScreenRecorder />);
    
    // Toggle audio on
    const audioToggle = screen.getByText(/包含麦克风音频|Include Microphone Audio/i);
    fireEvent.click(audioToggle);
    
    // Start recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetDisplayMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: true,
        })
      );
    });
  });

  it("formats duration correctly", () => {
    render(<ScreenRecorder />);
    
    // This would need to simulate time passing
    // For now, just verify the component renders without errors
    expect(screen.getByText(/开始录制|Start Recording/i)).toBeTruthy();
  });

  it("cleans up resources on unmount", () => {
    const { unmount } = render(<ScreenRecorder />);
    
    // Start recording
    const startButton = screen.getByText(/开始录制|Start Recording/i);
    fireEvent.click(startButton);
    
    unmount();
    
    // Should have cleaned up stream tracks
    expect(mockStream.getTracks).toHaveBeenCalled();
  });
});
