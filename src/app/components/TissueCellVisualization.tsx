'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import {
  TissueCellAnalysisResult,
  TissueSpecificCorrelation,
  CellSpecificCorrelation
} from '@/types';

interface TissueCellVisualizationProps {
  results: TissueCellAnalysisResult[];
  analysisMode: 'tissue-specific' | 'cell-specific';
}

interface CorrelationMetrics {
  name: string;
  pearson_corr: number;
  cosine_sim: number;
  jaccard_index: number;
  l2_norm_diff: number;
  overlap_count: number;
}

export default function TissueCellVisualization({
  results,
  analysisMode
}: TissueCellVisualizationProps) {
  const [selectedTissues, setSelectedTissues] = useState<string[]>([]);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<'pearson_corr' | 'cosine_sim' | 'jaccard_index'>('pearson_corr');
  const [selectedTissueForCells, setSelectedTissueForCells] = useState<string | null>(null);
  const [tissueExpressionData, setTissueExpressionData] = useState<any[]>([]);
  const [allTissueData, setAllTissueData] = useState<any>({});
  const [loadingTissueData, setLoadingTissueData] = useState(false);
  const [loadingAllData, setLoadingAllData] = useState(false);

  // Process data for visualization
  const visualizationData = useMemo(() => {
    if (!results.length) return [];

    const result = results[0]; // For now, display first result

    if (analysisMode === 'tissue-specific') {
      let tissueData = result.tissue_correlations || [];

      // Filter by selected tissues if any are selected
      if (selectedTissues.length > 0) {
        tissueData = tissueData.filter(t => selectedTissues.includes(t.tissue));
      }

      return tissueData.map(t => ({
        name: t.tissue.charAt(0).toUpperCase() + t.tissue.slice(1),
        pearson_corr: t.pearson_corr,
        cosine_sim: t.cosine_sim,
        jaccard_index: t.jaccard_index,
        l2_norm_diff: t.l2_norm_diff,
        overlap_count: t.overlap_count
      })).sort((a, b) => {
        if (metricType === 'pearson_corr') return Math.abs(b.pearson_corr) - Math.abs(a.pearson_corr);
        if (metricType === 'cosine_sim') return Math.abs(b.cosine_sim) - Math.abs(a.cosine_sim);
        if (metricType === 'jaccard_index') return b.jaccard_index - a.jaccard_index;
        return 0;
      }).map((item, index) => ({
        ...item,
        rank: index + 1
      }));
    } else {
      let cellData = result.cell_correlations || [];

      // Filter by selected cells if any are selected
      if (selectedCells.length > 0) {
        cellData = cellData.filter(c => selectedCells.includes(c.cell_type));
      }

      return cellData.map(c => ({
        name: c.cell_type,
        pearson_corr: c.pearson_corr,
        cosine_sim: c.cosine_sim,
        jaccard_index: c.jaccard_index,
        l2_norm_diff: c.l2_norm_diff,
        overlap_count: c.overlap_count
      }));
    }
  }, [results, analysisMode, selectedTissues, selectedCells, metricType]);


  // Fetch all tissue-cell expression data
  const fetchAllTissueData = async () => {
    if (!results.length) return;

    setLoadingAllData(true);
    try {
      const result = results[0];
      const selectedTissueList = selectedTissues.length > 0 ? selectedTissues : [];

      const response = await fetch(`/api/all-tissue-cell-expression?${new URLSearchParams({
        gene1: result.p1_name,
        gene2: result.p2_name,
        tissues: selectedTissueList.join(',')
      })}`);

      if (!response.ok) {
        throw new Error('Failed to fetch all tissue expression data');
      }

      const data = await response.json();
      setAllTissueData(data.tissueData || {});
    } catch (error) {
      console.error('Error fetching all tissue expression data:', error);
      setAllTissueData({});
    } finally {
      setLoadingAllData(false);
    }
  };

  // Load all tissue data when results change or tissues are selected
  useEffect(() => {
    if (results.length > 0 && analysisMode === 'tissue-specific') {
      fetchAllTissueData();
    }
  }, [results, analysisMode, selectedTissues]);

  // Get unique tissues/cells for filtering
  const availableItems = useMemo(() => {
    if (!results.length) return [];

    const result = results[0];

    if (analysisMode === 'tissue-specific') {
      return result.tissue_correlations?.map(t => t.tissue) || [];
    } else {
      return result.cell_correlations?.map(c => c.cell_type) || [];
    }
  }, [results, analysisMode]);

  // Clear selections when new results arrive
  useEffect(() => {
    if (availableItems.length > 0) {
      if (analysisMode === 'tissue-specific') {
        setSelectedTissues([]);
      } else {
        setSelectedCells([]);
      }
    }
  }, [availableItems, analysisMode]);

  // Color palette for tissues
  const tissueColors = useMemo(() => {
    const colors = [
      '#60A5FA', '#34D399', '#F87171', '#FBBF24', '#A78BFA',
      '#FB7185', '#38BDF8', '#4ADE80', '#F472B6', '#FACC15',
      '#818CF8', '#06B6D4', '#10B981', '#EF4444', '#8B5CF6',
      '#14B8A6', '#F59E0B', '#EC4899', '#3B82F6', '#84CC16'
    ];
    const tissues = Object.keys(allTissueData).sort();
    const colorMap: Record<string, string> = {};
    tissues.forEach((tissue, index) => {
      colorMap[tissue] = colors[index % colors.length];
    });
    return colorMap;
  }, [allTissueData]);

  const handleItemToggle = (item: string) => {
    if (analysisMode === 'tissue-specific') {
      setSelectedTissues(prev =>
        prev.includes(item)
          ? prev.filter(t => t !== item)
          : [...prev, item]
      );
    } else {
      setSelectedCells(prev =>
        prev.includes(item)
          ? prev.filter(c => c !== item)
          : [...prev, item]
      );
    }
  };

  const handleSelectAll = () => {
    if (analysisMode === 'tissue-specific') {
      if (selectedTissues.length === availableItems.length) {
        setSelectedTissues([]);
      } else {
        setSelectedTissues([...availableItems]);
      }
    } else {
      if (selectedCells.length === availableItems.length) {
        setSelectedCells([]);
      } else {
        setSelectedCells([...availableItems]);
      }
    }
  };

  // Fetch expression data for a specific tissue
  const fetchTissueExpressionData = async (tissue: string) => {
    if (!results.length) {
      console.log('No results available');
      return;
    }

    console.log('Fetching expression data for tissue:', tissue);
    setLoadingTissueData(true);
    try {
      const result = results[0];
      console.log('Using genes:', result.p1_name, result.p2_name);

      const response = await fetch(`/api/tissue-expression?${new URLSearchParams({
        gene1: result.p1_name,
        gene2: result.p2_name,
        tissue: tissue
      })}`);

      if (!response.ok) {
        throw new Error('Failed to fetch tissue expression data');
      }

      const data = await response.json();
      console.log('Received expression data:', data);
      setTissueExpressionData(data.expressionData || []);
    } catch (error) {
      console.error('Error fetching tissue expression data:', error);
      setTissueExpressionData([]);
    } finally {
      setLoadingTissueData(false);
    }
  };

  // Handle tissue click - show cell-specific data for that tissue
  const handleTissueClick = (tissue: string) => {
    setSelectedTissueForCells(tissue);
    fetchTissueExpressionData(tissue);
  };

  // Color scheme for different metrics
  const getBarColor = (metricType: string) => {
    switch (metricType) {
      case 'pearson_corr': return '#60A5FA';
      case 'cosine_sim': return '#34D399';
      case 'jaccard_index': return '#F59E0B';
      default: return '#60A5FA';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
          <p className="text-gray-900 font-medium">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">Pearson: {data.pearson_corr?.toFixed(3)}</p>
            <p className="text-green-600">Cosine: {data.cosine_sim?.toFixed(3)}</p>
            <p className="text-yellow-600">Jaccard: {data.jaccard_index?.toFixed(3)}</p>
            <p className="text-red-600">L2 Diff: {data.l2_norm_diff?.toFixed(3)}</p>
            <p className="text-purple-600">Overlap: {data.overlap_count}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!results.length) {
    return null;
  }

  const result = results[0];

  return (
    <div className="space-y-3">
      {/* Results Header */}
      <div className="bg-navy-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          {analysisMode === 'tissue-specific' ? 'Tissue-Specific' : 'Cell-Specific'} Correlation Results
        </h2>
        <div className="text-gray-300">
          <p className="mb-2">
            <span className="font-medium text-blue-400">{result.p1_name}</span>
            <span className="mx-2">⟷</span>
            <span className="font-medium text-emerald-400">{result.p2_name}</span>
          </p>
          <p className="text-sm">
            UniProt IDs: {result.p1_uniprot} ⟷ {result.p2_uniprot}
          </p>
          {result.p1_ensembl && result.p2_ensembl && (
            <p className="text-sm">
              Ensembl IDs: {result.p1_ensembl} ⟷ {result.p2_ensembl}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-navy-800 rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visualization Controls */}
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Visualization Controls</h3>
            <div className="space-y-3">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Metric
                </label>
                <select
                  value={metricType}
                  onChange={(e) => setMetricType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded bg-navy-700 text-black border border-navy-600 focus:outline-none focus:border-navy-400"
                >
                  <option value="pearson_corr">Pearson Correlation</option>
                  <option value="cosine_sim">Cosine Similarity</option>
                  <option value="jaccard_index">Jaccard Index</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-white">
                Filter {analysisMode === 'tissue-specific' ? 'Tissues' : 'Cell Types'}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    if (analysisMode === 'tissue-specific') {
                      setSelectedTissues([]);
                    } else {
                      setSelectedCells([]);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
                >
                  Deselect All
                </button>
                <button
                  onClick={() => {
                    if (analysisMode === 'tissue-specific') {
                      setSelectedTissues(availableItems);
                    } else {
                      setSelectedCells(availableItems);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                >
                  Select All
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableItems.map(item => (
                <label key={item} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      analysisMode === 'tissue-specific'
                        ? selectedTissues.includes(item)
                        : selectedCells.includes(item)
                    }
                    onChange={() => handleItemToggle(item)}
                    className="rounded border-navy-600 text-navy-600 focus:ring-navy-500"
                  />
                  <span className="text-gray-300 text-sm">
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Expression Plots - Show tissue-level data when no tissues selected, detailed when tissues selected */}
      {analysisMode === 'tissue-specific' && Object.keys(allTissueData).length > 0 && (
        <div className="space-y-2">
          {/* Gene 1 Expression Plot */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {results[0]?.p1_name} Expression Across {selectedTissues.length === 0 ? 'Tissues' : 'Cell Types'} (nTPM)
            </h3>
            {loadingAllData ? (
              <div className="text-center text-gray-500 py-8">Loading expression data...</div>
            ) : (
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      if (selectedTissues.length === 0) {
                        // Show all cell data grouped by tissue, filter out cells with 0 expression for both genes
                        return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                          allTissueData[tissue]
                            .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0) // Filter out 0 expression for both genes
                            .map((cell, cellIndex) => {
                              const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                cellType: cell.cellType,
                                tissue: tissue,
                                gene1_name: cell.gene1_name,
                                gene1_expression: cell.gene1_expression,
                                gene2_name: cell.gene2_name,
                                gene2_expression: cell.gene2_expression,
                                tissueGroup: tissueFormatted,
                                tissueRaw: tissue,
                                tissueIndex: tissueIdx,
                                cellIndex: cellIndex,
                                displayName: cell.cellType,
                                fullCellType: cell.cellType,
                                barColor: tissueColors[tissue] || '#60A5FA'
                              };
                            })
                        );
                      } else {
                        // Show detailed cell-type data for selected tissues only
                        const filteredTissues = Object.keys(allTissueData).sort().filter(tissue => selectedTissues.includes(tissue));
                        return filteredTissues.flatMap((tissue, tissueIdx) =>
                          allTissueData[tissue]
                            .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0) // Filter out 0 expression for both genes
                            .map((cell, cellIndex) => {
                              const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                cellType: cell.cellType,
                                tissue: tissue,
                                gene1_name: cell.gene1_name,
                                gene1_expression: cell.gene1_expression,
                                gene2_name: cell.gene2_name,
                                gene2_expression: cell.gene2_expression,
                                tissueGroup: tissueFormatted,
                                tissueRaw: tissue,
                                tissueIndex: tissueIdx,
                                cellIndex: cellIndex,
                                displayName: cell.cellType,
                                fullCellType: cell.cellType,
                                barColor: tissueColors[tissue] || '#60A5FA'
                              };
                            })
                        );
                      }
                    })()}
                    margin={{ top: 10, right: 20, left: 40, bottom: 60 }}
                    barCategoryGap="10%"
                    maxBarSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey={selectedTissues.length === 0 ? "tissueGroup" : "cellType"}
                      tick={{ fill: '#374151', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickSize={1}
                      interval={0}
                      tickFormatter={(value, index) => {
                        if (selectedTissues.length === 0) {
                          // For tissue view, only show label in the middle of each tissue group
                          const data = (() => {
                            if (selectedTissues.length === 0) {
                              return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                                allTissueData[tissue]
                                  .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                                  .map((cell, cellIndex) => {
                                    const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    return { tissueGroup: tissueFormatted };
                                  })
                              );
                            }
                            return [];
                          })();

                          const tissueGroups = {};
                          data.forEach((item, idx) => {
                            if (!tissueGroups[item.tissueGroup]) {
                              tissueGroups[item.tissueGroup] = [];
                            }
                            tissueGroups[item.tissueGroup].push(idx);
                          });

                          const tissueMiddleIndices = Object.values(tissueGroups).map(indices =>
                            Math.floor((indices[0] + indices[indices.length - 1]) / 2)
                          );

                          return tissueMiddleIndices.includes(index) ? value : '';
                        }
                        return value;
                      }}
                    />
                    <YAxis
                      tick={{ fill: '#374151', fontSize: 10 }}
                      label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                              <p className="text-gray-900 font-medium">{data.tissueGroup}</p>
                              <p className="text-gray-700 text-sm">{data.fullCellType}</p>
                              <p className="text-blue-600">
                                {data.gene1_name}: {Number(payload[0].value).toFixed(2)} nTPM
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="gene1_expression"
                      radius={[2, 2, 0, 0]}
                    >
                      {(() => {
                        if (selectedTissues.length === 0) {
                          // Color by tissue for all cell data
                          return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                            allTissueData[tissue]
                              .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                              .map((cell, cellIndex) => (
                                <Cell key={`cell-${tissueIdx}-${cellIndex}`} fill={tissueColors[tissue] || '#60A5FA'} />
                              ))
                          );
                        } else {
                          // Color by tissue for selected tissues' cell data
                          const filteredTissues = Object.keys(allTissueData).sort().filter(tissue => selectedTissues.includes(tissue));
                          return filteredTissues.flatMap((tissue, tissueIdx) =>
                            allTissueData[tissue]
                              .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                              .map((cell, cellIndex) => (
                                <Cell key={`cell-${tissueIdx}-${cellIndex}`} fill={tissueColors[tissue] || '#60A5FA'} />
                              ))
                          );
                        }
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gene 2 Expression Plot */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {results[0]?.p2_name} Expression Across {selectedTissues.length === 0 ? 'Tissues' : 'Cell Types'} (nTPM)
            </h3>
            {loadingAllData ? (
              <div className="text-center text-gray-500 py-8">Loading expression data...</div>
            ) : (
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      if (selectedTissues.length === 0) {
                        // Show all cell data grouped by tissue, filter out cells with 0 expression for both genes
                        return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                          allTissueData[tissue]
                            .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0) // Filter out 0 expression for both genes
                            .map((cell, cellIndex) => {
                              const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                cellType: cell.cellType,
                                tissue: tissue,
                                gene1_name: cell.gene1_name,
                                gene1_expression: cell.gene1_expression,
                                gene2_name: cell.gene2_name,
                                gene2_expression: cell.gene2_expression,
                                tissueGroup: tissueFormatted,
                                tissueRaw: tissue,
                                tissueIndex: tissueIdx,
                                cellIndex: cellIndex,
                                displayName: cell.cellType,
                                fullCellType: cell.cellType,
                                barColor: tissueColors[tissue] || '#34D399'
                              };
                            })
                        );
                      } else {
                        // Show detailed cell-type data for selected tissues only
                        const filteredTissues = Object.keys(allTissueData).sort().filter(tissue => selectedTissues.includes(tissue));
                        return filteredTissues.flatMap((tissue, tissueIdx) =>
                          allTissueData[tissue]
                            .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0) // Filter out 0 expression for both genes
                            .map((cell, cellIndex) => {
                              const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                cellType: cell.cellType,
                                tissue: tissue,
                                gene1_name: cell.gene1_name,
                                gene1_expression: cell.gene1_expression,
                                gene2_name: cell.gene2_name,
                                gene2_expression: cell.gene2_expression,
                                tissueGroup: tissueFormatted,
                                tissueRaw: tissue,
                                tissueIndex: tissueIdx,
                                cellIndex: cellIndex,
                                displayName: cell.cellType,
                                fullCellType: cell.cellType,
                                barColor: tissueColors[tissue] || '#34D399'
                              };
                            })
                        );
                      }
                    })()}
                    margin={{ top: 10, right: 20, left: 40, bottom: 60 }}
                    barCategoryGap="10%"
                    maxBarSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey={selectedTissues.length === 0 ? "tissueGroup" : "cellType"}
                      tick={{ fill: '#374151', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickSize={1}
                      interval={0}
                      tickFormatter={(value, index) => {
                        if (selectedTissues.length === 0) {
                          // For tissue view, only show label in the middle of each tissue group
                          const data = (() => {
                            if (selectedTissues.length === 0) {
                              return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                                allTissueData[tissue]
                                  .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                                  .map((cell, cellIndex) => {
                                    const tissueFormatted = tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    return { tissueGroup: tissueFormatted };
                                  })
                              );
                            }
                            return [];
                          })();

                          const tissueGroups = {};
                          data.forEach((item, idx) => {
                            if (!tissueGroups[item.tissueGroup]) {
                              tissueGroups[item.tissueGroup] = [];
                            }
                            tissueGroups[item.tissueGroup].push(idx);
                          });

                          const tissueMiddleIndices = Object.values(tissueGroups).map(indices =>
                            Math.floor((indices[0] + indices[indices.length - 1]) / 2)
                          );

                          return tissueMiddleIndices.includes(index) ? value : '';
                        }
                        return value;
                      }}
                    />
                    <YAxis
                      tick={{ fill: '#374151', fontSize: 10 }}
                      label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                              <p className="text-gray-900 font-medium">{data.tissueGroup}</p>
                              <p className="text-gray-700 text-sm">{data.fullCellType}</p>
                              <p className="text-emerald-600">
                                {data.gene2_name}: {Number(payload[0].value).toFixed(2)} nTPM
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="gene2_expression"
                      radius={[2, 2, 0, 0]}
                    >
                      {(() => {
                        if (selectedTissues.length === 0) {
                          // Color by tissue for all cell data
                          return Object.keys(allTissueData).sort().flatMap((tissue, tissueIdx) =>
                            allTissueData[tissue]
                              .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                              .map((cell, cellIndex) => (
                                <Cell key={`cell-${tissueIdx}-${cellIndex}`} fill={tissueColors[tissue] || '#34D399'} />
                              ))
                          );
                        } else {
                          // Color by tissue for selected tissues' cell data
                          const filteredTissues = Object.keys(allTissueData).sort().filter(tissue => selectedTissues.includes(tissue));
                          return filteredTissues.flatMap((tissue, tissueIdx) =>
                            allTissueData[tissue]
                              .filter(cell => cell.gene1_expression > 0 || cell.gene2_expression > 0)
                              .map((cell, cellIndex) => (
                                <Cell key={`cell-${tissueIdx}-${cellIndex}`} fill={tissueColors[tissue] || '#34D399'} />
                              ))
                          );
                        }
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correlation Analysis */}
      <div className="bg-white rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {analysisMode === 'tissue-specific' ? 'Tissue' : 'Cell Type'} Correlation Analysis
        </h3>

        {visualizationData.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={visualizationData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  tick={{
                    fill: '#374151',
                    fontSize: 10,
                    content: (props: any) => {
                      const { x, y, payload } = props;
                      const data = visualizationData.find(d => d.name === payload.value);
                      if (!data) return null;
                      return (
                        <g>
                          <text
                            x={x}
                            y={y}
                            fill="#374151"
                            fontSize="10"
                            textAnchor="end"
                            transform={`rotate(-45, ${x}, ${y})`}
                          >
                            #{data.rank} {payload.value}
                          </text>
                        </g>
                      );
                    }
                  }}
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fill: '#374151', fontSize: 10 }}
                  domain={metricType === 'l2_norm_diff' ? [0, 'auto'] : [-1, 1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={metricType}
                  fill={getBarColor(metricType)}
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => {
                    if (analysisMode === 'tissue-specific') {
                      console.log('Clicked tissue:', data.name);
                      handleTissueClick(data.name.toLowerCase());
                    }
                  }}
                  style={{ cursor: analysisMode === 'tissue-specific' ? 'pointer' : 'default' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            {analysisMode === 'tissue-specific'
              ? 'No tissues selected for visualization. Click on "Select All" to show all tissues.'
              : 'No cell types selected for visualization'}
          </div>
        )}
      </div>

      {/* Cell-Specific Expression Plots for Selected Tissue */}
      {selectedTissueForCells && analysisMode === 'tissue-specific' && (
        <div className="space-y-3">
          {console.log('Rendering cell-specific plots for:', selectedTissueForCells, 'Data length:', tissueExpressionData.length)}
          {/* Header */}
          <div className="bg-navy-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">
                Cell-Specific Expression in {selectedTissueForCells.charAt(0).toUpperCase() + selectedTissueForCells.slice(1)}
              </h3>
              <button
                onClick={() => setSelectedTissueForCells(null)}
                className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
              >
                Close
              </button>
            </div>
            {loadingTissueData && (
              <div className="text-gray-300 text-sm mt-2">Loading cell expression data...</div>
            )}
          </div>

          {/* Expression Plots */}
          {tissueExpressionData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gene 1 Expression Plot */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {tissueExpressionData[0]?.gene1_name} Expression (nTPM)
                </h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tissueExpressionData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="cellType"
                        tick={{ fill: '#374151', fontSize: 8 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: '#374151', fontSize: 10 }}
                        label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                                <p className="text-gray-900 font-medium">{label}</p>
                                <p className="text-blue-600">
                                  {payload[0].payload.gene1_name}: {Number(payload[0].value).toFixed(2)} nTPM
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="gene1_expression"
                        fill="#60A5FA"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gene 2 Expression Plot */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {tissueExpressionData[0]?.gene2_name} Expression (nTPM)
                </h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tissueExpressionData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="cellType"
                        tick={{ fill: '#374151', fontSize: 8 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: '#374151', fontSize: 10 }}
                        label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                                <p className="text-gray-900 font-medium">{label}</p>
                                <p className="text-emerald-600">
                                  {payload[0].payload.gene2_name}: {Number(payload[0].value).toFixed(2)} nTPM
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="gene2_expression"
                        fill="#34D399"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* No data message */}
          {!loadingTissueData && tissueExpressionData.length === 0 && (
            <div className="bg-white rounded-lg p-6 text-center text-gray-500">
              No expression data available for {selectedTissueForCells}
            </div>
          )}
        </div>
      )}

    </div>
  );
}