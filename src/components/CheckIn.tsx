import { useState, useEffect } from 'react';
import type { DailyEntry, Question } from '../types';
import { storageService } from '../services/storage';
import questionsData from '../config/questions.json';

interface CheckInProps {
  readOnly?: boolean;
}

const CheckIn = ({ readOnly = false }: CheckInProps) => {
  const questions: Question[] = questionsData.questions as Question[];
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const existing = storageService.getEntryByDate(today);
    
    if (existing) {
      setEntry(existing);
    } else {
      // Auto-create today entry
      const newEntry: DailyEntry = {
        date: today,
        answers: {}
      };
      setEntry(newEntry);
    }
  }, []);

  const handleAnswer = (questionId: string, value: boolean | number) => {
    if (readOnly || !entry) return;
    
    setEntry(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        answers: { ...prev.answers, [questionId]: value }
      };
      storageService.saveEntry(updated);
      return updated;
    });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  };

  const renderQuestion = (question: Question) => {
    const value = entry?.answers[question.id];

    switch (question.type) {
      case 'boolean':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleAnswer(question.id, true)}
              disabled={readOnly}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                value === true
                  ? 'bg-green-500 text-white'
                  : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer(question.id, false)}
              disabled={readOnly}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                value === false
                  ? 'bg-gray-500 text-white'
                  : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              No
            </button>
          </div>
        );

      case 'scale':
        return (
          <div className="flex gap-1">
            {Array.from({ length: question.max! - question.min! + 1 }, (_, i) => {
              const num = question.min! + i;
              return (
                <button
                  key={num}
                  onClick={() => handleAnswer(question.id, num)}
                  disabled={readOnly}
                  className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                    value === num
                      ? 'bg-blue-500 text-white'
                      : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            step="0.1"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => handleAnswer(question.id, parseFloat(e.target.value) || 0)}
            disabled={readOnly}
            className="w-32 px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.0"
          />
        );

      default:
        return null;
    }
  };

  if (!entry) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          {readOnly ? "Today's Check-in" : "Check-in Today"}
        </h3>
        {saved && (
          <span className="text-xs text-green-500">Saved!</span>
        )}
      </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="flex items-center justify-between">
            <label className="text-sm text-[var(--text-primary)]">{question.label}</label>
            {renderQuestion(question)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CheckIn;