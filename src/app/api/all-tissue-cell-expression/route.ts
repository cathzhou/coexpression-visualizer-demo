import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gene1 = searchParams.get('gene1');
    const gene2 = searchParams.get('gene2');
    const tissues = searchParams.get('tissues'); // comma-separated list

    if (!gene1 || !gene2) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Build query
    let query: any = {
      $or: [
        { gene_name: { $in: [gene1, gene2] } },
        { gene: { $in: [gene1, gene2] } },
        { gene_name: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene_name: { $regex: new RegExp(`^${gene2}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene2}$`, 'i') } }
      ]
    };

    // Add tissue filter if provided
    if (tissues) {
      const tissueList = tissues.split(',').map(t => t.trim());
      query.tissue = { $in: tissueList };
    }

    const expressionData = await collection.find(query).toArray();

    // Separate data by gene
    const gene1Data = expressionData.filter(record =>
      record.gene_name.toLowerCase() === gene1.toLowerCase() ||
      record.gene.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(record =>
      record.gene_name.toLowerCase() === gene2.toLowerCase() ||
      record.gene.toLowerCase() === gene2.toLowerCase()
    );

    // Group by tissue, then by cell type
    const tissueGroupedData: any = {};
    const allTissues = [...new Set(expressionData.map(record => record.tissue))];

    for (const tissue of allTissues) {
      const tissueCellData: any[] = [];
      const gene1TissueData = gene1Data.filter(record => record.tissue === tissue);
      const gene2TissueData = gene2Data.filter(record => record.tissue === tissue);

      const uniqueCellTypes = [...new Set([
        ...gene1TissueData.map(record => record.cell_type_full),
        ...gene2TissueData.map(record => record.cell_type_full)
      ])];

      for (const cellType of uniqueCellTypes) {
        const gene1Cell = gene1TissueData.find(record => record.cell_type_full === cellType);
        const gene2Cell = gene2TissueData.find(record => record.cell_type_full === cellType);

        tissueCellData.push({
          cellType: cellType,
          tissue: tissue,
          gene1_name: gene1Data[0]?.gene_name || gene1,
          gene1_expression: gene1Cell?.nTPM || 0,
          gene2_name: gene2Data[0]?.gene_name || gene2,
          gene2_expression: gene2Cell?.nTPM || 0,
          cluster: gene1Cell?.cluster || gene2Cell?.cluster || '',
          cell_type: gene1Cell?.cell_type || gene2Cell?.cell_type || ''
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