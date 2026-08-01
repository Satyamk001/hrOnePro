import { useState } from "react";
import type { AttendanceRecord } from "../types";
import { parseAttendanceData } from "../utils/parser";

interface InputPanelProps {
  onDataParsed: (data: AttendanceRecord[]) => void;
}

export default function InputPanel({ onDataParsed }: InputPanelProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
  };

  const handleAnalyze = () => {
    const result = parseAttendanceData(text);
    if (result.success) {
      setError(null);
      onDataParsed(result.data);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <textarea
        className="w-full min-h-[200px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
        placeholder="Paste your attendance JSON data here..."
        value={text}
        onChange={handleChange}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <button
        className="mt-3 px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        onClick={handleAnalyze}
      >
        Analyze
      </button>
    </div>
  );
}
