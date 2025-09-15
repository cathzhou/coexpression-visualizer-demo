'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import TissueCellVisualization from '../components/TissueCellVisualization';
import {
  TissueSpecificCorrelation,
  CellSpecificCorrelation,
  TissueCellAnalysisResult
} from '@/types';

const AVAILABLE_TISSUES = [
  'adipose tissue', 'bone marrow', 'brain', 'breast', 'bronchus', 'colon',
  'endometrium', 'esophagus', 'eye', 'fallopian tube', 'heart muscle', 'kidney',
  'liver', 'lung', 'lymph node', 'ovary', 'pancreas', 'pbmc', 'placenta',
  'prostate', 'rectum', 'salivary gland', 'skeletal muscle', 'skin',
  'small intestine', 'spleen', 'stomach', 'testis', 'thymus', 'tongue', 'vascular'
];

export default function TissueCellAnalysisPage() {
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
  const fetchCellTypes = async () => {
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
  };

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
  }, [analysisMode]);

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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-white">
              Tissue & Cell-Specific Co-expression Analysis
            </h1>
            <Link
              href="/"
              className="px-4 py-2 bg-navy-600 text-white rounded hover:bg-navy-500"
            >
              ← Back to Search
            </Link>
          </div>
          <p className="text-gray-300 max-w-3xl">
            Analyze gene co-expression patterns within specific tissues or cell types.
            Compare correlation values across different biological contexts to identify
            tissue-specific or cell-type-specific interactions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          {/* Analysis Mode Selection */}
          <div className="space-y-4">
            <div className="flex space-x-4 justify-center">
              <button
                type="button"
                onClick={() => setAnalysisMode('tissue-specific')}
                className={`px-6 py-3 rounded-lg font-medium ${
                  analysisMode === 'tissue-specific'
                    ? 'bg-navy-600 text-white'
                    : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                }`}
              >
                Tissue-Specific Analysis
              </button>
              <button
                type="button"
                onClick={() => setAnalysisMode('cell-specific')}
                className={`px-6 py-3 rounded-lg font-medium ${
                  analysisMode === 'cell-specific'
                    ? 'bg-navy-600 text-white'
                    : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                }`}
              >
                Cell-Specific Analysis
              </button>
            </div>

            <div className="text-center text-gray-300 text-sm">
              {analysisMode === 'tissue-specific' ? (
                <p>Analyze correlation within selected tissues (using cells within each tissue)</p>
              ) : (
                <p>Analyze correlation within selected cell types (using tissue expression profiles)</p>
              )}
            </div>
          </div>

          {/* Gene Input Section */}
          <div className="bg-navy-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Gene Pair Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gene1" className="block text-sm font-medium text-gray-300 mb-2">
                  Gene 1 (Name or UniProt ID)
                </label>
                <input
                  id="gene1"
                  type="text"
                  value={gene1}
                  onChange={(e) => setGene1(e.target.value)}
                  placeholder="e.g., TNFRSF1A, P19438"
                  className="w-full px-3 py-2 rounded bg-white text-black border border-navy-600 focus:outline-none focus:border-navy-400"
                  required
                />
              </div>
              <div>
                <label htmlFor="gene2" className="block text-sm font-medium text-gray-300 mb-2">
                  Gene 2 (Name or UniProt ID)
                </label>
                <input
                  id="gene2"
                  type="text"
                  value={gene2}
                  onChange={(e) => setGene2(e.target.value)}
                  placeholder="e.g., TNF, P01375"
                  className="w-full px-3 py-2 rounded bg-white text-black border border-navy-600 focus:outline-none focus:border-navy-400"
                  required
                />
              </div>
            </div>
          </div>

          {/* Tissue/Cell Selection */}
          <div className="bg-navy-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                {analysisMode === 'tissue-specific' ? 'Select Tissues' : 'Select Cell Types'}
              </h3>
              {analysisMode === 'tissue-specific' ? (
                <button
                  type="button"
                  onClick={handleSelectAllTissues}
                  className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                >
                  {selectedTissues.length === AVAILABLE_TISSUES.length ? 'Deselect All' : 'Select All'}
                </button>
              ) : availableCellTypes.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllCells}
                  className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                >
                  {selectedCells.length === availableCellTypes.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {analysisMode === 'tissue-specific' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {AVAILABLE_TISSUES.map(tissue => (
                  <label key={tissue} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTissues.includes(tissue)}
                      onChange={() => handleTissueToggle(tissue)}
                      className="rounded border-navy-600 text-navy-600 focus:ring-navy-500"
                    />
                    <span className="text-gray-300 text-sm">
                      {tissue.charAt(0).toUpperCase() + tissue.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div>
                {cellTypesLoading ? (
                  <div className="text-center text-gray-300 py-4">
                    Loading available cell types...
                  </div>
                ) : availableCellTypes.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {availableCellTypes.map(cellType => (
                        <label key={cellType} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCells.includes(cellType)}
                            onChange={() => handleCellToggle(cellType)}
                            className="rounded border-navy-600 text-navy-600 focus:ring-navy-500"
                          />
                          <span className="text-gray-300 text-sm">
                            {cellType.charAt(0).toUpperCase() + cellType.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-300">
                    <p className="mb-2">No cell types available. Please ensure the expression data is imported.</p>
                    <p className="text-sm text-gray-400">
                      Run: npm run import-expression-data
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              type="submit"
              disabled={loading || !gene1 || !gene2 ||
                (analysisMode === 'tissue-specific' && selectedTissues.length === 0) ||
                (analysisMode === 'cell-specific' && selectedCells.length === 0)
              }
              className="px-8 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Analyzing...' : 'Start Analysis'}
            </button>
          </div>
        </form>


        {/* Error Display */}
        {error && (
          <div className="text-red-500 text-center mb-8">
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Results Visualization */}
        {results.length > 0 && (
          <TissueCellVisualization
            results={results}
            analysisMode={analysisMode}
          />
        )}
      </div>
    </div>
  );
}