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
    const cellType = searchParams.get('cellType');
    const tissues = searchParams.get('tissues'); // comma-separated list for tissue-specific mode

    if (!gene1 || !gene2) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

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

    // Cell-specific mode: filter by specific cell type
    if (cellType) {
      query.ct = cellType;

      const expressionData = await collection.find(query).toArray();

      // Separate data by gene
      const gene1Data = expressionData.filter(record =>
        record.gn.toLowerCase() === gene1.toLowerCase() ||
        record.g.toLowerCase() === gene1.toLowerCase()
      );

      const gene2Data = expressionData.filter(record =>
        record.gn.toLowerCase() === gene2.toLowerCase() ||
        record.g.toLowerCase() === gene2.toLowerCase()
      );

      // Create tissue expression data for this cell type
      const tissueData: any[] = [];
      const uniqueTissues = [...new Set(expressionData.map(record => record.t))];

      for (const tissue of uniqueTissues) {
        const gene1Tissue = gene1Data.find(record => record.t === tissue);
        const gene2Tissue = gene2Data.find(record => record.t === tissue);

        // Only include if at least one gene has expression > 0
        if ((gene1Tissue?.n || 0) > 0 || (gene2Tissue?.n || 0) > 0) {
          tissueData.push({
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

      // Sort by tissue name
      tissueData.sort((a, b) => a.tissue.localeCompare(b.tissue));

      return NextResponse.json(tissueData);
    }

    // Tissue-specific mode (original functionality): filter by tissues
    if (tissues) {
      const tissueList = tissues.split(',').map(t => t.trim());
      query.t = { $in: tissueList };
    }

    const expressionData = await collection.find(query).toArray();

    // Separate data by gene
    const gene1Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene1.toLowerCase() ||
      record.g.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene2.toLowerCase() ||
      record.g.toLowerCase() === gene2.toLowerCase()
    );

    // Group by tissue, then by cell type
    const tissueGroupedData: any = {};
    const allTissues = [...new Set(expressionData.map(record => record.t))];

    for (const tissue of allTissues) {
      const tissueCellData: any[] = [];
      const gene1TissueData = gene1Data.filter(record => record.t === tissue);
      const gene2TissueData = gene2Data.filter(record => record.t === tissue);

      const uniqueCellTypes = [...new Set([
        ...gene1TissueData.map(record => record.ct),
        ...gene2TissueData.map(record => record.ct)
      ])];

      for (const cellTypeItem of uniqueCellTypes) {
        const gene1Cell = gene1TissueData.find(record => record.ct === cellTypeItem);
        const gene2Cell = gene2TissueData.find(record => record.ct === cellTypeItem);

        tissueCellData.push({
          cellType: cellTypeItem,
          tissue: tissue,
          gene1_name: gene1Data[0]?.gn || gene1,
          gene1_expression: gene1Cell?.n || 0,
          gene2_name: gene2Data[0]?.gn || gene2,
          gene2_expression: gene2Cell?.n || 0,
          cluster: gene1Cell?.c || gene2Cell?.c || '',
          cell_type: gene1Cell?.ct || gene2Cell?.ct || ''
        });
      }

      // Sort by cell type within tissue
      tissueCellData.sort((a, b) => a.cellType.localeCompare(b.cellType));
      tissueGroupedData[tissue] = tissueCellData;
    }

    return NextResponse.json({
      gene1,
      gene2,
      tissueData: tissueGroupedData
    });

  } catch (error) {
    console.error('Error fetching all tissue cell expression data:', error);
    return NextResponse.json({
      error: 'Failed to fetch expression data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}