import React, { useState, useRef, useCallback } from 'react';
import { importAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './ImportPDF.css';

const TYPE_COLORS = {
  announcement: '#6366f1', assignment: '#f59e0b', exam: '#ef4444',
  gpa_report: '#22c55e',  students: '#3b82f6',  major_change: '#8b5cf6',
  courses: '#0ea5e9',     unknown: '#94a3b8',
};
const TYPE_ICONS = {
  announcement: '📢', assignment: '📝', exam: '📅',
  gpa_report: '📊', students: '🎓', major_change: '🔄',
  courses: '📚', unknown: '❓',
};

const isExcelFile = (f) => f && (
  f.name.match(/\.(xlsx|xls)$/i) ||
  f.type.includes('spreadsheet') ||
  f.type.includes('excel')
);

const ImportPDF = () => {
  const { t } = useLanguage();
  const DOC_TYPES = [
    { value: '',             label: `🤖 ${t('importPDF.autoDetect')}`,    desc: t('importPDF.autoDetectDesc') },
    { value: 'announcement', label: `📢 ${t('importPDF.announcement')}`,  desc: t('importPDF.announcementDesc') },
    { value: 'assignment',   label: `📝 ${t('importPDF.assignment')}`,    desc: t('importPDF.assignmentDesc') },
    { value: 'exam',         label: `📅 ${t('importPDF.exam')}`,          desc: t('importPDF.examDesc') },
    { value: 'gpa_report',   label: `📊 ${t('importPDF.gpaReport')}`,     desc: t('importPDF.gpaReportDesc') },
    { value: 'students',     label: `🎓 ${t('importPDF.newStudents')}`,   desc: t('importPDF.newStudentsDesc') },
    { value: 'major_change', label: `🔄 ${t('importPDF.majorChange')}`,   desc: t('importPDF.majorChangeDesc') },
    { value: 'courses',      label: `📚 ${t('importPDF.courseList')}`,    desc: t('importPDF.courseListDesc') },
  ];

  const [file,     setFile]     = useState(null);
  const [docType,  setDocType]  = useState('');
  const [dragging, setDragging] = useState(false);
  const [stage,    setStage]    = useState('idle');
  const [preview,  setPreview]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const fileRef = useRef();

  const reset = () => {
    setFile(null); setDocType(''); setStage('idle');
    setPreview(null); setResult(null); setError('');
  };

  const onFile = (f) => {
    if (!f) return;
    const isPDF   = f.type === 'application/pdf' || f.name.match(/\.pdf$/i);
    const isExcel = f.name.match(/\.(xlsx|xls)$/i) || f.type.includes('spreadsheet') || f.type.includes('excel');
    if (!isPDF && !isExcel) {
      setError('Please upload a PDF or Excel (.xlsx / .xls) file.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) { setError('File must be under 20 MB.'); return; }
    setFile(f); setError(''); setStage('idle'); setPreview(null); setResult(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    onFile(e.dataTransfer.files[0]);
  }, []); // eslint-disable-line

  const handlePreview = async () => {
    if (!file) return;
    setStage('previewing'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await importAPI.preview(fd);
      setPreview(res.data);
      setStage('preview');
      if (!docType && res.data.detectedType) setDocType(res.data.detectedType);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setStage('idle');
    }
  };

  const handleApply = async () => {
    if (!file) return;
    setStage('applying'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (docType) fd.append('docType', docType);
      const res = await importAPI.apply(fd);
      setResult(res.data);
      setStage('done');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setStage('preview');
    }
  };

  const detectedLabel = preview?.detectedType
    ? (DOC_TYPES.find(d => d.value === preview.detectedType)?.label || preview.detectedType)
    : null;

  const effectiveType = docType || preview?.detectedType || 'unknown';
  const typeColor = TYPE_COLORS[effectiveType] || '#94a3b8';
  const typeIcon  = TYPE_ICONS[effectiveType]  || '❓';
  const fileIsExcel = isExcelFile(file);

  return (
    <div className="import-page">
      <div className="import-header">
        <h1>📥 Import File</h1>
        <p>Upload a <strong>PDF</strong> or <strong>Excel (.xlsx)</strong> document — the system will detect its type and apply the data automatically.</p>
        {/* Format badges */}
        <div className="import-format-badges">
          <span className="import-format-badge import-format-pdf">📄 PDF</span>
          <span className="import-format-badge import-format-excel">📊 Excel (.xlsx / .xls)</span>
        </div>
      </div>

      {/* Supported types grid */}
      <div className="import-types-grid">
        {DOC_TYPES.filter(d => d.value).map(d => (
          <div
            key={d.value}
            className={`import-type-card ${docType === d.value ? 'selected' : ''}`}
            style={{ '--type-color': TYPE_COLORS[d.value] }}
            onClick={() => setDocType(prev => prev === d.value ? '' : d.value)}
          >
            <span className="import-type-icon">{d.label.split(' ')[0]}</span>
            <span className="import-type-label">{d.label.replace(/^[^\s]+ /, '')}</span>
            <span className="import-type-desc">{d.desc}</span>
            {docType === d.value && <span className="import-type-check">✓</span>}
          </div>
        ))}
      </div>

      {docType && (
        <p className="import-override-note">
          🔒 Type locked to <strong>{DOC_TYPES.find(d=>d.value===docType)?.label}</strong>
          <button className="import-clear-lock" onClick={() => setDocType('')}>✕ Clear</button>
        </p>
      )}

      {/* Drop zone */}
      {(stage === 'idle' || stage === 'previewing') && (
        <div
          className={`import-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={e => onFile(e.target.files[0])}
          />
          {file ? (
            <>
              <div className="import-file-icon">{fileIsExcel ? '📊' : '📄'}</div>
              <div className="import-file-name">{file.name}</div>
              <div className="import-file-meta">
                <span className={`import-file-type-badge ${fileIsExcel ? 'excel' : 'pdf'}`}>
                  {fileIsExcel ? 'Excel' : 'PDF'}
                </span>
                <span className="import-file-size">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <button className="import-change-file" onClick={e => { e.stopPropagation(); reset(); }}>✕ Remove</button>
            </>
          ) : (
            <>
              <div className="import-drop-icon">⬆️</div>
              <div className="import-drop-text">
                Drag & drop a <strong>PDF</strong> or <strong>Excel</strong> file here, or <span>click to browse</span>
              </div>
              <div className="import-drop-sub">Supports PDF and .xlsx / .xls files up to 20 MB</div>
            </>
          )}
        </div>
      )}

      {error && <div className="import-error">⚠️ {error}</div>}

      {/* Actions */}
      {file && (stage === 'idle' || stage === 'previewing') && (
        <div className="import-actions">
          <button className="import-btn-preview" onClick={handlePreview} disabled={stage === 'previewing'}>
            {stage === 'previewing' ? '⏳ Scanning…' : '🔍 Scan & Preview'}
          </button>
        </div>
      )}

      {/* Preview panel */}
      {stage === 'preview' && preview && (
        <div className="import-preview-panel">
          <div className="import-preview-header">
            <div className="import-detected-badge" style={{ background: typeColor }}>
              {typeIcon} {detectedLabel || 'Detected: ' + preview.detectedType}
            </div>
            <div className="import-preview-meta">
              {preview.lineCount} lines extracted · {file.name}
              {preview.fileType === 'excel' && preview.sheetName && (
                <span className="import-sheet-badge"> · Sheet: {preview.sheetName}</span>
              )}
            </div>
          </div>

          <div className="import-type-select-row">
            <label>Document type:</label>
            <select value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="import-preview-text">
            <strong>Extracted content preview:</strong>
            <pre>{preview.preview}</pre>
          </div>

          {/* Show detected column mapping for transparency */}
          {preview.detectedColumns?.length > 0 && (
            <div className="import-col-map">
              <strong>🧠 Detected columns:</strong>
              <div className="import-col-map-list">
                {preview.detectedColumns.map(c => (
                  <span key={c.field} className="import-col-chip">
                    <span className="import-col-field">{c.field}</span>
                    <span className="import-col-arrow">→</span>
                    <span className="import-col-header">"{c.header || `col ${c.column}`}"</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="import-actions">
            <button className="import-btn-cancel" onClick={reset}>✕ Cancel</button>
            <button className="import-btn-apply" onClick={handleApply} style={{ background: typeColor }}>
              {TYPE_ICONS[effectiveType]} Apply to System
            </button>
          </div>
        </div>
      )}

      {/* Applying spinner */}
      {stage === 'applying' && (
        <div className="import-applying">
          <div className="import-spinner" />
          <p>Applying data to the system…</p>
        </div>
      )}

      {/* Result panel */}
      {stage === 'done' && result && (
        <div className="import-result-panel">
          <div className="import-result-header" style={{ borderColor: typeColor }}>
            <span className="import-result-icon">✅</span>
            <div>
              <h2>Import Complete</h2>
              <p>{file?.name} — {DOC_TYPES.find(d => d.value === result.detectedType)?.label || result.detectedType}</p>
            </div>
          </div>

          <div className="import-result-kpis">
            <div className="import-kpi" style={{ '--kc': '#22c55e' }}>
              <span>{result.processed}</span><label>Processed</label>
            </div>
            <div className="import-kpi" style={{ '--kc': '#f59e0b' }}>
              <span>{result.skipped}</span><label>Skipped</label>
            </div>
            <div className="import-kpi" style={{ '--kc': '#ef4444' }}>
              <span>{result.errors?.length || 0}</span><label>Errors</label>
            </div>
          </div>

          {result.details?.length > 0 && (
            <div className="import-result-details">
              <strong>Details:</strong>
              <div className="import-details-list">
                {result.details.map((d, i) => (
                  <div key={i} className="import-detail-row">
                    {typeof d === 'object'
                      ? Object.entries(d).map(([k, v]) => (
                          <span key={k} className="import-detail-kv">
                            <span className="import-detail-key">{k}</span>
                            <span className="import-detail-val">{String(v)}</span>
                          </span>
                        ))
                      : <span>{String(d)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors?.length > 0 && (
            <div className="import-result-errors">
              <strong>⚠️ Errors / Warnings:</strong>
              <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          <div className="import-actions">
            <button className="import-btn-preview" onClick={reset}>📥 Import Another</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPDF;


