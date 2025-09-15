import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';
import {
  TissueCellAnalysisResult,
  TissueSpecificCorrelation,
  CellSpecificCorrelation,
  CellTypeInfo
} from '@/types';

interface ExpressionRecord {
  gene: string;
  gene_name: string;
  tissue: string;
  cluster: string;
  cell_type: string;
  read_count: number;
  nTPM: number;
  cell_type_full: string;
  tissue_cell_combo: string;
}

// Helper function to send SSE message
function sendSSEMessage(data: any) {
  return new Response(
    `data: ${JSON.stringify(data)}\n\n`,
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}

// Load expression data from MongoDB for specific genes
async function loadExpressionDataForGenes(gene1: string, gene2: string): Promise<ExpressionRecord[]> {
  try {
    console.log('Loading expression data from MongoDB for genes:', gene1, gene2);

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Query for both genes using gene name or ensembl ID
    const query = {
      $or: [
        { gene_name: { $in: [gene1, gene2] } },
        { gene: { $in: [gene1, gene2] } },
        { gene_name: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene_name: { $regex: new RegExp(`^${gene2}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene2}$`, 'i') } }
      ]
    };

    const data = await collection.find(query).toArray();
    console.log('Retrieved expression records from MongoDB:', data.length);

    return data;
  } catch (error) {
    console.error('Error loading expression data from MongoDB:', error);
    throw new Error(`Error querying expression data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Compute correlation metrics between two vectors
function computeCorrelationMetrics(vec1: number[], vec2: number[]) {
  if (vec1.length !== vec2.length || vec1.length === 0) {
    return {
      pearson_corr: 0,
      cosine_sim: 0,
      jaccard_index: 0,
      l2_norm_diff: 0,
      overlap_count: 0
    };
  }

  // Check for zero vectors
  const sum1 = vec1.reduce((a, b) => a + b, 0);
  const sum2 = vec2.reduce((a, b) => a + b, 0);

  if (sum1 === 0 || sum2 === 0) {
    return {
      pearson_corr: 0,
      cosine_sim: 0,
      jaccard_index: 0,
      l2_norm_diff: Math.sqrt(vec1.map((v, i) => Math.pow(v - vec2[i], 2)).reduce((a, b) => a + b, 0)),
      overlap_count: 0
    };
  }

  // Calculate means
  const mean1 = sum1 / vec1.length;
  const mean2 = sum2 / vec2.length;

  // Pearson correlation
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < vec1.length; i++) {
    const diff1 = vec1[i] - mean1;
    const diff2 = vec2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const pearson_corr = (sum1Sq === 0 || sum2Sq === 0) ? 0 : numerator / Math.sqrt(sum1Sq * sum2Sq);

  // Cosine similarity
  const dot_product = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  const cosine_sim = (norm1 === 0 || norm2 === 0) ? 0 : dot_product / (norm1 * norm2);

  // Binary vectors for Jaccard (using median as threshold)
  const median1 = [...vec1].sort((a, b) => a - b)[Math.floor(vec1.length / 2)];
  const median2 = [...vec2].sort((a, b) => a - b)[Math.floor(vec2.length / 2)];

  const binary1 = vec1.map(v => v > median1 ? 1 : 0);
  const binary2 = vec2.map(v => v > median2 ? 1 : 0);

  const intersection = binary1.reduce((sum, v, i) => sum + (v && binary2[i] ? 1 : 0), 0);
  const union = binary1.reduce((sum, v, i) => sum + (v || binary2[i] ? 1 : 0), 0);
  const jaccard_index = union === 0 ? 0 : intersection / union;

  // L2 norm difference
  const l2_norm_diff = Math.sqrt(vec1.map((v, i) => Math.pow(v - vec2[i], 2)).reduce((a, b) => a + b, 0));

  // Overlap count (both above median)
  const overlap_count = binary1.reduce((sum, v, i) => sum + (v && binary2[i] ? 1 : 0), 0);

  return {
    pearson_corr: isNaN(pearson_corr) ? 0 : pearson_corr,
    cosine_sim: isNaN(cosine_sim) ? 0 : cosine_sim,
    jaccard_index: isNaN(jaccard_index) ? 0 : jaccard_index,
    l2_norm_diff: isNaN(l2_norm_diff) ? 0 : l2_norm_diff,
    overlap_count
  };
}

// Function to handle tissue-specific analysis
async function handleTissueSpecificAnalysis(
  gene1: string,
  gene2: string,
  selectedTissues: string[]
) {
  try {
    const expressionData = await loadExpressionDataForGenes(gene1, gene2);

    // Filter data for the two genes
    const gene1Data = expressionData.filter(row =>
      row.gene_name.toLowerCase() === gene1.toLowerCase() ||
      row.gene.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(row =>
      row.gene_name.toLowerCase() === gene2.toLowerCase() ||
      row.gene.toLowerCase() === gene2.toLowerCase()
    );

    if (gene1Data.length === 0 || gene2Data.length === 0) {
      return sendSSEMessage({
        error: `One or both genes not found in dataset: ${gene1}, ${gene2}`
      });
    }

    // Get unique tissues to analyze
    const tissues = selectedTissues.length > 0
      ? selectedTissues
      : [...new Set(expressionData.map(row => row.tissue))];

    const tissueCorrelations: TissueSpecificCorrelation[] = [];

    for (const tissue of tissues) {
      // Get expression data for this tissue
      const gene1TissueData = gene1Data.filter(row => row.tissue === tissue);
      const gene2TissueData = gene2Data.filter(row => row.tissue === tissue);

      if (gene1TissueData.length === 0 || gene2TissueData.length === 0) {
        continue;
      }

      // Create cell type expression vectors within this tissue
      const cellTypes = [...new Set(gene1TissueData.map(row => row.cell_type_full))];

      const vec1: number[] = [];
      const vec2: number[] = [];

      for (const cellTypeFull of cellTypes) {
        const gene1Cell = gene1TissueData.find(row => row.cell_type_full === cellTypeFull);
        const gene2Cell = gene2TissueData.find(row => row.cell_type_full === cellTypeFull);

        if (gene1Cell && gene2Cell) {
          vec1.push(gene1Cell.nTPM);
          vec2.push(gene2Cell.nTPM);
        }
      }

      if (vec1.length > 1) { // Need at least 2 data points for correlation
        const metrics = computeCorrelationMetrics(vec1, vec2);
        tissueCorrelations.push({
          tissue,
          ...metrics
        });
      }
    }

    const result: TissueCellAnalysisResult = {
      p1_name: gene1Data[0]?.gene_name || gene1,
      p1_uniprot: gene1,
      p1_ensembl: gene1Data[0]?.gene || '',
      p2_name: gene2Data[0]?.gene_name || gene2,
      p2_uniprot: gene2,
      p2_ensembl: gene2Data[0]?.gene || '',
      pair_id: `${gene1}_${gene2}`,
      tissue_correlations: tissueCorrelations,
      cell_correlations: []
    };

    return sendSSEMessage({ results: [result] });

  } catch (error) {
    console.error('Tissue-specific analysis error:', error);
    return sendSSEMessage({
      error: 'Error processing tissue-specific analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Function to handle cell-specific analysis
async function handleCellSpecificAnalysis(
  gene1: string,
  gene2: string,
  selectedCells: string[]
) {
  try {
    const expressionData = await loadExpressionDataForGenes(gene1, gene2);

    // Filter data for the two genes
    const gene1Data = expressionData.filter(row =>
      row.gene_name.toLowerCase() === gene1.toLowerCase() ||
      row.gene.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(row =>
      row.gene_name.toLowerCase() === gene2.toLowerCase() ||
      row.gene.toLowerCase() === gene2.toLowerCase()
    );

    if (gene1Data.length === 0 || gene2Data.length === 0) {
      return sendSSEMessage({
        error: `One or both genes not found in dataset: ${gene1}, ${gene2}`
      });
    }

    // Get unique cell types to analyze
    const cellTypes = selectedCells.length > 0
      ? selectedCells
      : [...new Set(gene1Data.map(row => row.cell_type_full))];

    const cellCorrelations: CellSpecificCorrelation[] = [];

    for (const cellTypeFull of cellTypes) {
      // Get expression data for this cell type across tissues
      const gene1CellData = gene1Data.filter(row => row.cell_type_full === cellTypeFull);
      const gene2CellData = gene2Data.filter(row => row.cell_type_full === cellTypeFull);

      if (gene1CellData.length === 0 || gene2CellData.length === 0) {
        continue;
      }

      // Create tissue expression vectors for this cell type
      const tissues = [...new Set(gene1CellData.map(row => row.tissue))];

      const vec1: number[] = [];
      const vec2: number[] = [];

      for (const tissue of tissues) {
        const gene1Tissue = gene1CellData.find(row => row.tissue === tissue);
        const gene2Tissue = gene2CellData.find(row => row.tissue === tissue);

        if (gene1Tissue && gene2Tissue) {
          vec1.push(gene1Tissue.nTPM);
          vec2.push(gene2Tissue.nTPM);
        }
      }

      if (vec1.length > 1) { // Need at least 2 data points for correlation
        const metrics = computeCorrelationMetrics(vec1, vec2);
        cellCorrelations.push({
          cell_type: cellTypeFull,
          ...metrics
        });
      }
    }

    const result: TissueCellAnalysisResult = {
      p1_name: gene1Data[0]?.gene_name || gene1,
      p1_uniprot: gene1,
      p1_ensembl: gene1Data[0]?.gene || '',
      p2_name: gene2Data[0]?.gene_name || gene2,
      p2_uniprot: gene2,
      p2_ensembl: gene2Data[0]?.gene || '',
      pair_id: `${gene1}_${gene2}`,
      tissue_correlations: [],
      cell_correlations: cellCorrelations
    };

    return sendSSEMessage({ results: [result] });

  } catch (error) {
    console.error('Cell-specific analysis error:', error);
    return sendSSEMessage({
      error: 'Error processing cell-specific analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gene1 = searchParams.get('gene1');
    const gene2 = searchParams.get('gene2');
    const analysisMode = searchParams.get('analysisMode') as 'tissue-specific' | 'cell-specific';
    const selectedItems = searchParams.get('selectedItems');

    if (!gene1 || !gene2 || !analysisMode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const selectedItemsArray = selectedItems ? selectedItems.split(',').filter(Boolean) : [];

    if (analysisMode === 'tissue-specific') {
      return handleTissueSpecificAnalysis(gene1, gene2, selectedItemsArray);
    } else {
      return handleCellSpecificAnalysis(gene1, gene2, selectedItemsArray);
    }

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}