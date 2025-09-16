'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import TissueCellVisualization from './components/TissueCellVisualization';
import CellSpecificVisualization from './components/CellSpecificVisualization';
import {
  TissueCellAnalysisResult
} from '@/types';

const AVAILABLE_TISSUES = [
  'adipose tissue', 'bone marrow', 'brain', 'breast', 'bronchus', 'colon',
  'endometrium', 'esophagus', 'eye', 'fallopian tube', 'heart muscle', 'kidney',
  'liver', 'lung', 'lymph node', 'ovary', 'pancreas', 'pbmc', 'placenta',
  'prostate', 'rectum', 'salivary gland', 'skeletal muscle', 'skin',
  'small intestine', 'spleen', 'stomach', 'testis', 'thymus', 'tongue', 'vascular'
];

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<'tissue-specific' | 'cell-specific'>('tissue-specific');
  const [gene1, setGene1] = useState('');
  const [gene2, setGene2] = useState('');
  const [selectedTissues, setSelectedTissues] = useState<string[]>([]);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [availableCellTypes, setAvailableCellTypes] = useState<string[]>([]);
  const [results, setResults] = useState<TissueCellAnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cellTypesLoading, setCellTypesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);

  // Fetch available cell types when switching to cell-specific mode
  const fetchCellTypes = useCallback(async () => {
    if (availableCellTypes.length > 0) return; // Already loaded

    setCellTypesLoading(true);
    try {
      const response = await fetch('/api/cell-types');
      const data = await response.json();

      if (data.cellTypes) {
        setAvailableCellTypes(data.cellTypes);
      }
    } catch (error) {
      console.error('Error fetching cell types:', error);
      setError('Failed to load cell types');
    } finally {
      setCellTypesLoading(false);
    }
  }, [availableCellTypes.length]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setProcessedCount(0);

    await fetchAnalysisResults();
  };

  const fetchAnalysisResults = async () => {
    try {
      const selectedItems = analysisMode === 'tissue-specific' ? selectedTissues : selectedCells;

      const eventSource = new EventSource(`/api/tissue-cell-analysis?${new URLSearchParams({
        gene1,
        gene2,
        analysisMode,
        selectedItems: selectedItems.join(',')
      })}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.currentGene) {
          setProcessedCount(prev => prev + 1);
        } else if (data.results) {
          setResults(data.results);
          eventSource.close();
          // Keep loading indicator for 5 seconds to allow expression data to load
          setTimeout(() => {
            setLoading(false);
            setProcessedCount(0);
          }, 5000);
        } else if (data.error) {
          setError(data.error);
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setError('Connection error occurred');
        setLoading(false);
        setProcessedCount(0);
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
      setProcessedCount(0);
    }
  };

  const handleTissueToggle = (tissue: string) => {
    setSelectedTissues(prev =>
      prev.includes(tissue)
        ? prev.filter(t => t !== tissue)
        : [...prev, tissue]
    );
  };

  const handleCellToggle = (cellType: string) => {
    setSelectedCells(prev =>
      prev.includes(cellType)
        ? prev.filter(c => c !== cellType)
        : [...prev, cellType]
    );
  };

  const handleSelectAllTissues = () => {
    if (selectedTissues.length === AVAILABLE_TISSUES.length) {
      setSelectedTissues([]);
    } else {
      setSelectedTissues([...AVAILABLE_TISSUES]);
    }
  };

  const handleSelectAllCells = () => {
    if (selectedCells.length === availableCellTypes.length) {
      setSelectedCells([]);
    } else {
      setSelectedCells([...availableCellTypes]);
    }
  };

  // Load cell types when switching to cell-specific mode
  useEffect(() => {
    if (analysisMode === 'cell-specific') {
      fetchCellTypes();
    }
  }, [analysisMode, fetchCellTypes]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      const eventSource = new EventSource('/api/tissue-cell-analysis');
      eventSource.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-4 text-white">
            Tissue & Cell-Specific Analysis
          </h1>
          <p className="text-gray-300 text-center mb-8 max-w-3xl mx-auto">
            Analyze gene co-expression patterns across tissues and cell types. Compare two genes to explore their correlation profiles and expression patterns.
          </p>
        </div>

        {/* Analysis Form */}
        <div className="bg-navy-800 rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Analysis Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Analysis Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAnalysisMode('tissue-specific')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    analysisMode === 'tissue-specific'
                      ? 'bg-navy-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Tissue-Specific Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisMode('cell-specific')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    analysisMode === 'cell-specific'
                      ? 'bg-navy-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Cell-Specific Analysis
                </button>
              </div>
            </div>

            {/* Gene Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gene1" className="block text-sm font-medium text-gray-300 mb-2">
                  Gene 1
                </label>
                <input
                  type="text"
                  id="gene1"
                  value={gene1}
                  onChange={(e) => setGene1(e.target.value)}
                  placeholder="e.g., AGTR1"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="gene2" className="block text-sm font-medium text-gray-300 mb-2">
                  Gene 2
                </label>
                <input
                  type="text"
                  id="gene2"
                  value={gene2}
                  onChange={(e) => setGene2(e.target.value)}
                  placeholder="e.g., AGTR2"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Tissue/Cell Selection */}
            {analysisMode === 'tissue-specific' ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Select Tissues (optional - leave empty for all)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllTissues}
                    className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                  >
                    {selectedTissues.length === AVAILABLE_TISSUES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-3 bg-gray-700 rounded">
                  {AVAILABLE_TISSUES.map(tissue => (
                    <label key={tissue} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTissues.includes(tissue)}
                        onChange={() => handleTissueToggle(tissue)}
                        className="rounded border-gray-400 text-navy-600 focus:ring-navy-500"
                      />
                      <span className="text-gray-300 text-sm">
                        {tissue.replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Select Cell Types (optional - leave empty for all)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllCells}
                    className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                    disabled={cellTypesLoading}
                  >
                    {selectedCells.length === availableCellTypes.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {cellTypesLoading ? (
                  <div className="text-gray-400 text-center py-4">Loading cell types...</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-3 bg-gray-700 rounded">
                    {availableCellTypes.map(cellType => (
                      <label key={cellType} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCells.includes(cellType)}
                          onChange={() => handleCellToggle(cellType)}
                          className="rounded border-gray-400 text-navy-600 focus:ring-navy-500"
                        />
                        <span className="text-gray-300 text-sm">
                          {cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !gene1 || !gene2}
              className="w-full bg-navy-600 text-white py-3 px-4 rounded-md hover:bg-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-navy-800 rounded-lg p-6 mb-8">
            <div className="text-center">
              <div className="text-gray-300 mb-2">
                Processing analysis... {processedCount > 0 && `(${processedCount} items processed)`}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-navy-600 h-2 rounded-full animate-pulse w-1/3"></div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8">
            <div className="text-red-200">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            {analysisMode === 'tissue-specific' ? (
              <TissueCellVisualization results={results} analysisMode={analysisMode} />
            ) : (
              <CellSpecificVisualization results={results} analysisMode={analysisMode} />
            )}
          </>
        )}
      </div>
    </div>
  );
}