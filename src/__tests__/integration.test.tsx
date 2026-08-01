import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

const VALID_SINGLE_RECORD = JSON.stringify([
  {
    employeeId: 1,
    shiftId: 1,
    timeIn: "09:00",
    timeout: "18:00",
    presentStatus: "Present",
    calculatedWorkingHours: "09:00",
    isLeave: 0,
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    shiftCode: "GS",
    attendanceDate: "2024-01-15",
    updatedFirstHalfStatus: "P",
    updatedSecondHalfStatus: "P",
  },
]);

describe("Integration: Full Data Flow", () => {
  it("displays empty state with prompt and example JSON when no data is loaded", () => {
    render(<App />);

    expect(
      screen.getByText("Paste your attendance JSON data to see insights")
    ).toBeInTheDocument();

    // Verify the example JSON code block is present
    expect(screen.getByText(/employeeId/)).toBeInTheDocument();
  });

  it("displays inline error when invalid JSON is pasted and Analyze is clicked", () => {
    render(<App />);

    const textarea = screen.getByPlaceholderText(
      "Paste your attendance JSON data here..."
    );
    const button = screen.getByText("Analyze");

    fireEvent.change(textarea, { target: { value: "not valid json {{{" } });
    fireEvent.click(button);

    expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();
  });

  it("displays inline error when empty input is submitted", () => {
    render(<App />);

    const button = screen.getByText("Analyze");
    fireEvent.click(button);

    expect(
      screen.getByText(
        "No input provided. Please paste your attendance JSON data."
      )
    ).toBeInTheDocument();
  });

  it("renders Dashboard with expected metrics after valid JSON is parsed", async () => {
    render(<App />);

    const textarea = screen.getByPlaceholderText(
      "Paste your attendance JSON data here..."
    );
    const button = screen.getByText("Analyze");

    fireEvent.change(textarea, { target: { value: VALID_SINGLE_RECORD } });
    fireEvent.click(button);

    // Dashboard should now be visible with metrics
    await waitFor(() => {
      expect(screen.getByText("Total Days")).toBeInTheDocument();
    });

    // Verify key metric card titles and values for a single Present day with 9h worked
    expect(screen.getByText("Total Working Hours")).toBeInTheDocument();
    expect(screen.getAllByText("9h 0m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Overtime")).toBeInTheDocument();
    expect(screen.getByText("Shortfall")).toBeInTheDocument();
    expect(screen.getByText("Average Hours")).toBeInTheDocument();
    expect(screen.getByText("Late Arrivals")).toBeInTheDocument();
    expect(screen.getByText("0 (0.0%)")).toBeInTheDocument();
  });

  it("renders all components (Dashboard, Charts, DayTable) with single-day data", async () => {
    render(<App />);

    const textarea = screen.getByPlaceholderText(
      "Paste your attendance JSON data here..."
    );
    const button = screen.getByText("Analyze");

    fireEvent.change(textarea, { target: { value: VALID_SINGLE_RECORD } });
    fireEvent.click(button);

    // Verify Dashboard section
    await waitFor(() => {
      expect(screen.getByText("Total Days")).toBeInTheDocument();
    });

    // Verify DayTable section header
    expect(screen.getByText("Day-by-Day Details")).toBeInTheDocument();

    // Verify table has a row with the date from the record
    expect(screen.getByText("2024-01-15")).toBeInTheDocument();

    // Verify the empty state prompt is no longer visible
    expect(
      screen.queryByText("Paste your attendance JSON data to see insights")
    ).not.toBeInTheDocument();
  });
});
