
import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Copy, Download, Trash2, Tag, ClipboardPaste } from 'lucide-react';
import { processGmpDocument } from './services/geminiService';
import { FileState, ProcessingResult } from './types';
import * as XLSX from 'xlsx';

const APP_SCRIPT_TEMPLATE = `function jsonToExcel(jsonInput) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DATA");

  if (!sheet) sheet = ss.insertSheet("DATA");
  sheet.clear();

  const data = typeof jsonInput === 'string'
    ? JSON.parse(jsonInput)
    : jsonInput;

  const rows = data.data;
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const values = rows.map(r => headers.map(h => r[h] ?? ""));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}`;

const App: React.FC = () => {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const handleFileData = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setFileState({
        file,
        base64,
        type: file.type,
        preview: URL.createObjectURL(file)
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileData(file);
  };

  // Tính năng Paste từ Clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: blob.type });
            handleFileData(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileData]);

  const handleProcess = async () => {
    if (!fileState) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await processGmpDocument(fileState.base64, fileState.type);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!result) return;
    const ws = XLSX.utils.json_to_sheet(result.data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DATA");
    XLSX.writeFile(wb, `GMP_${result.doc_type}_${new Date().getTime()}.xlsx`);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const reset = () => {
    setFileState(null);
    setResult(null);
    setError(null);
  };

  const getDocTypeLabel = (type: string) => {
    switch(type) {
      case 'BCSPKPH': return 'BC Sản Phẩm Không Phù Hợp';
      case 'PHIEU_THAY_DOI': return 'Phiếu Thay Đổi';
      case 'DE_XUAT_CAI_TIEN': return 'Đề Xuất Cải Tiến';
      default: return 'Tài liệu khác';
    }
  };

  const CopyableRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex items-center justify-between gap-4 p-3 bg-white border rounded-lg group hover:border-blue-300 transition-colors">
      <div className="flex-1 min-w-0">
        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">{label}</label>
        <p className="text-sm font-semibold text-slate-800 truncate">{value || '--'}</p>
      </div>
      <button 
        onClick={() => copyToClipboard(value, label)}
        className="flex-shrink-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
        title="Copy nội dung"
      >
        <Copy size={16} />
      </button>
    </div>
  );

  const CopyableTextArea = ({ label, value, italic = false }: { label: string, value: string, italic?: boolean }) => {
    const renderContent = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-blue-700 font-extrabold bg-blue-50 px-1 rounded">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    const renderLines = (text: string) => {
      if (!text) return '--';
      return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.match(/^[123]\./)) {
          return (
            <div key={i} className="mt-4 first:mt-0 font-bold text-blue-900 border-b-2 border-blue-100 pb-1 mb-2 bg-slate-50 px-2 py-1 rounded">
              {renderContent(trimmed)}
            </div>
          );
        }
        if (trimmed.startsWith('-')) {
          return (
            <div key={i} className="pl-2 py-1 font-semibold text-slate-800 mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full flex-shrink-0"></span>
              {renderContent(trimmed.substring(1).trim())}
            </div>
          );
        }
        if (trimmed.startsWith('+')) {
          return (
            <div key={i} className="pl-8 py-1 relative text-slate-600 border-l-2 border-blue-100 ml-4">
              <span className="absolute left-[-11px] top-3 w-5 h-[2px] bg-blue-100"></span>
              <span className="text-blue-500 font-bold mr-2">+</span>
              {renderContent(trimmed.substring(1).trim())}
            </div>
          );
        }
        return (
          <div key={i} className="py-1 text-slate-600 pl-4">
            {renderContent(line)}
          </div>
        );
      });
    };

    return (
      <div className="p-4 bg-white border rounded-xl group hover:border-blue-400 transition-all shadow-sm relative">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
          <button 
            onClick={() => copyToClipboard(value, label)}
            className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Copy size={14} />
          </button>
        </div>
        <div className={`text-[13px] leading-relaxed whitespace-pre-wrap ${italic ? 'italic text-slate-500' : 'text-slate-800'}`}>
          {renderLines(value)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md shadow-blue-200">
              <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">GMP Data Extraction Pro</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Hệ thống trích xuất thông minh v2.5
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Tải tài liệu lên</h2>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-tighter">
                  <ClipboardPaste size={12} /> Hỗ trợ Paste Ctrl+V
                </div>
              </div>
              {!fileState ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer relative group">
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    accept="image/*,application/pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="bg-blue-100 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <Upload className="text-blue-600 w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-700 font-medium">Click để chọn tài liệu</p>
                    <p className="text-slate-400 text-sm mt-1">Hoặc nhấn <kbd className="bg-slate-100 border px-1 rounded text-slate-600 font-sans">Ctrl</kbd> + <kbd className="bg-slate-100 border px-1 rounded text-slate-600 font-sans">V</kbd> để dán ảnh</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700 truncate">{fileState.file.name}</span>
                    </div>
                    <button onClick={reset} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {fileState.type.startsWith('image/') && (
                    <div className="relative rounded-xl overflow-hidden border bg-slate-100 aspect-video flex items-center justify-center">
                      <img src={fileState.preview} alt="Preview" className="max-h-full object-contain" />
                    </div>
                  )}
                  <button
                    disabled={loading}
                    onClick={handleProcess}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" /> Đang xử lý hồ sơ...</>
                    ) : (
                      <><CheckCircle size={20} /> Bắt đầu trích xuất</>
                    )}
                  </button>
                </div>
              )}
            </section>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border overflow-hidden min-h-[500px] flex flex-col">
              <div className="border-b px-6 py-4 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-800">Kết quả</h2>
                  {result && (
                    <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                      <Tag size={10} /> {result.doc_type}
                    </span>
                  )}
                </div>
                {result && (
                  <button 
                    onClick={downloadExcel}
                    className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl shadow-md transition-all active:scale-95"
                  >
                    <Download size={16} /> Xuất Excel
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-6">
                {!result && !loading && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                    <div className="bg-slate-50 p-8 rounded-full">
                      <FileText size={48} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-medium">Sẵn sàng trích xuất dữ liệu</p>
                    <p className="text-xs text-slate-400">Thử nhấn Ctrl+V để dán ảnh ngay</p>
                  </div>
                )}
                {loading && (
                  <div className="h-full flex flex-col items-center justify-center text-blue-500 gap-5">
                    <Loader2 className="animate-spin w-14 h-14" />
                    <div className="text-center">
                      <p className="font-bold text-slate-800 text-lg">AI đang đọc chi tiết...</p>
                      <p className="text-slate-500 text-sm mt-2">Đảm bảo không bỏ sót thông tin thay đổi</p>
                    </div>
                  </div>
                )}
                {result && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    {result.data.map((item: any, idx) => (
                      <div key={idx} className="space-y-4">
                        {result.doc_type === 'BCSPKPH' ? (
                          <div className="grid gap-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <CopyableRow label="Mã Số BC" value={item.nonconformity_code} />
                              <CopyableRow label="Ngày Áp Dụng" value={item.apply_date} />
                            </div>
                            <CopyableRow label="Tên Sản Phẩm" value={item.product_name} />
                            <div className="grid sm:grid-cols-2 gap-3">
                              <CopyableRow label="Số Lô" value={item.batch_number} />
                              <CopyableRow label="Công Đoạn" value={item.process_step} />
                            </div>
                            <CopyableTextArea label="Nội Dung Không Phù Hợp" value={item.nonconformity_content} />
                            <CopyableTextArea label="Nguyên Nhân Gốc" value={item.root_cause} />
                            <CopyableTextArea label="Hành Động Khắc Phục" value={item.corrective_action} italic />
                          </div>
                        ) : result.doc_type === 'DE_XUAT_CAI_TIEN' ? (
                          <div className="grid gap-3">
                            <CopyableTextArea label="Nội dung đề xuất cải tiến" value={item.proposal_content} />
                          </div>
                        ) : (
                          <div className="grid gap-4">
                            <CopyableRow label="Tên Sản Phẩm" value={item.product_name} />
                            <CopyableRow label="Số Lô" value={item.batch_number} />
                            <CopyableTextArea label="Nội dung thay đổi chi tiết" value={item.change_content} />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="pt-8 border-t">
                      <div className="bg-slate-900 rounded-2xl p-5 overflow-hidden group relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dữ liệu JSON & Apps Script</h3>
                          <button 
                            onClick={() => copyToClipboard(APP_SCRIPT_TEMPLATE, 'Mã Script')}
                            className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white text-[10px] font-bold transition-all"
                          >
                            Copy Script
                          </button>
                        </div>
                        <pre className="text-[10px] text-blue-300 font-mono leading-relaxed max-h-[250px] overflow-auto scrollbar-hide">
                          {`// Google Apps Script\n${APP_SCRIPT_TEMPLATE}\n\n// Data Payload\nconst input = ${JSON.stringify(result, null, 2)};`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {copySuccess && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 border border-slate-700">
          <div className="bg-green-500 rounded-full p-1 shadow-sm shadow-green-200">
            <CheckCircle size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium">Đã copy {copySuccess}!</span>
        </div>
      )}
    </div>
  );
};

export default App;
