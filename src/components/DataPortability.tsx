import { useState, useRef } from 'react';
import { storageService } from '../services/storage';

const DataPortability = () => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = storageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-dashboard-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setMessage('Data exported successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = storageService.importData(content);
        setMessage(result.message);
      } catch (error) {
        setMessage('Failed to import file');
      }
      setTimeout(() => setMessage(''), 3000);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Data</h3>
      
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Export JSON
        </button>
        
        <label className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Import JSON
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
      
      {message && (
        <p className="text-xs text-green-500 mt-2">{message}</p>
      )}
    </div>
  );
};

export default DataPortability;