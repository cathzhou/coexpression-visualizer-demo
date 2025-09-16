import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

interface ExpressionRecord {
  g: string;         // gene
  gn: string;        // gene_name
  t: string;         // tissue
  c: string;         // cluster
  ct: string;        // cell_type
  n: number;         // nTPM
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gene1 = searchParams.get('gene1');
    const gene2 = searchParams.get('gene2');
    const cellTypes = searchParams.get('cellTypes'); // comma-separated list

    if (!gene1 || !gene2) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('Fetching bulk cell expression data for genes:', gene1, gene2);

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Build query - optimized for performance
    const geneNames = [gene1.toUpperCase(), gene2.toUpperCase(), gene1.toLowerCase(), gene2.toLowerCase()];
    let query: any = {
      $or: [
        { gn: { $in: geneNames } },
        { g: { $in: geneNames } }
      ]
    };

    // Add cell type filter if provided
    if (cellTypes) {
      const cellTypeList = cellTypes.split(',').map(t => t.trim());
      query.ct = { $in: cellTypeList };
    }

    const expressionData = await collection.find(query).toArray();
    console.log('Retrieved expression records:', expressionData.length);

    // Separate data by gene
    const gene1Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene1.toLowerCase() ||
      record.g.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene2.toLowerCase() ||
      record.g.toLowerCase() === gene2.toLowerCase()
    );

    // Group by cell type, then by tissue
    const cellGroupedData: any = {};
    const allCellTypes = [...new Set(expressionData.map(record => record.ct))];

    for (const cellType of allCellTypes) {
      const cellTissueData: any[] = [];
      const gene1CellData = gene1Data.filter(record => record.ct === cellType);
      const gene2CellData = gene2Data.filter(record => record.ct === cellType);

      const uniqueTissues = [...new Set([
        ...gene1CellData.map(record => record.t),
        ...gene2CellData.map(record => record.t)
      ])];

      for (const tissue of uniqueTissues) {
        const gene1Tissue = gene1CellData.find(record => record.t === tissue);
        const gene2Tissue = gene2CellData.find(record => record.t === tissue);

        // Only include if at least one gene has expression > 0
        if ((gene1Tissue?.n || 0) > 0 || (gene2Tissue?.n || 0) > 0) {
          cellTissueData.push({
            tissueType: tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            tissue: tissue,
            cellType: cellType,
            gene1_name: gene1Data[0]?.gn || gene1,
            gene1_expression: gene1Tissue?.n || 0,
            gene2_name: gene2Data[0]?.gn || gene2,
            gene2_expression: gene2Tissue?.n || 0
          });
        }
      }

      // Sort by tissue within cell type
      cellTissueData.sort((a, b) => a.tissue.localeCompare(b.tissue));
      cellGroupedData[cellType] = cellTissueData;
    }

    console.log('Processed expression data for', Object.keys(cellGroupedData).length, 'cell types');

    return NextResponse.json(cellGroupedData);

  } catch (error) {
    console.error('Error fetching all cell expression data:', error);
    return NextResponse.json({
      error: 'Failed to fetch cell expression data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}